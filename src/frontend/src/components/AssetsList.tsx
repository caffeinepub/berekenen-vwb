import { useState } from "react";
import { toast } from "sonner";
import { AssetView, AssetType } from "../backend.d";
import { calculateFifo } from "../utils/fifo";
import { formatQuantity, formatEuro } from "../utils/format";
import { MoneyValue, ReturnValue } from "./MoneyValue";
import { AssetBadge } from "./AssetBadge";
import { AddTransactionDialog } from "./AddTransactionDialog";
import { EditAssetDialog } from "./EditAssetDialog";
import { TransactionHistory } from "./TransactionHistory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Check, X, PlusCircle, Inbox, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDeleteAsset } from "../hooks/useQueries";

interface AssetsListProps {
  assets: AssetView[];
  isLoading: boolean;
  terMap: Record<string, number>;
  updateTer: (ticker: string, pct: number | null) => void;
  ongoingCostsMap: Record<string, boolean>;
  updateOngoingCosts: (ticker: string, enabled: boolean) => void;
  /** Set of tickers that are commodities — affects badge display and hides TER */
  commodityTickers?: Set<string>;
}

interface TerEditState {
  ticker: string;
  value: string;
}

function DeleteAssetButton({ asset }: { asset: AssetView }) {
  const deleteAsset = useDeleteAsset();

  const handleDelete = async () => {
    try {
      await deleteAsset.mutateAsync(asset.ticker);
      toast.success(`${asset.ticker} verwijderd`);
    } catch {
      toast.error("Fout bij het verwijderen van asset");
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-loss"
          title="Verwijderen"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Asset verwijderen?</AlertDialogTitle>
          <AlertDialogDescription>
            Wil je <strong>{asset.ticker} — {asset.name}</strong> verwijderen? Alle transacties
            worden ook verwijderd. Deze actie kan niet ongedaan worden gemaakt.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Verwijderen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AssetsList({ assets, isLoading, terMap, updateTer, ongoingCostsMap, updateOngoingCosts, commodityTickers }: AssetsListProps) {
  const [terEdit, setTerEdit] = useState<TerEditState | null>(null);

  const startTerEdit = (ticker: string) => {
    const current = terMap[ticker];
    setTerEdit({ ticker, value: current !== undefined ? String(current) : "" });
  };

  const cancelTerEdit = () => setTerEdit(null);

  const saveTerEdit = (ticker: string) => {
    if (!terEdit) return;
    const raw = terEdit.value.trim().replace(",", ".");
    if (raw === "") {
      updateTer(ticker, null);
      toast.success(`TER verwijderd voor ${ticker}`);
    } else {
      const pct = parseFloat(raw);
      if (isNaN(pct) || pct < 0 || pct > 5) {
        toast.error("Ongeldig TER-percentage (0–5%)");
        return;
      }
      updateTer(ticker, pct);
      toast.success(`TER bijgewerkt voor ${ticker}`);
    }
    setTerEdit(null);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {["a", "b", "c"].map((k) => (
          <div key={k} className="bg-card border border-border rounded-lg p-5">
            <Skeleton className="h-5 w-48 mb-3" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
          <Inbox className="w-6 h-6 text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Geen assets gevonden</p>
          <p className="text-sm text-muted-foreground mt-1">
            Voeg je eerste aandeel of crypto toe om te beginnen.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {assets.map((asset, idx) => {
        const fifo = calculateFifo(asset.transactions, asset.currentPrice);
        const currentValue = fifo.currentQuantity * asset.currentPrice;
        const isCrypto = asset.assetType === AssetType.crypto;
        const isStock = asset.assetType === AssetType.stock;
        const isCommodityAsset = !!(commodityTickers?.has(asset.ticker));
        const isEditingTer = terEdit?.ticker === asset.ticker;
        const terValue = terMap[asset.ticker];
        const hasTer = !!(ongoingCostsMap[asset.ticker] && terValue !== undefined && terValue !== null && terValue > 0);

        // Transactiekosten = som van alle fees
        const totalTxFees = asset.transactions.reduce((s, tx) => s + (tx.fees ?? 0), 0);

        // Lopende kosten (TER) — op basis van totale actuele waarde van het asset
        // Alleen voor aandelen/ETF, niet voor crypto en niet voor grondstoffen
        const totalTerCosts =
          isStock && !isCommodityAsset && hasTer
            ? fifo.currentQuantity * asset.currentPrice * (terValue / 100)
            : 0;

        // Totale kosten = transactiekosten + lopende kosten TER
        const totalCosts = totalTxFees + totalTerCosts;

        return (
          <div
            key={asset.ticker}
            className="bg-card border border-border rounded-lg overflow-hidden opacity-0 animate-fade-in-up"
            style={{
              animationDelay: `${idx * 40}ms`,
              animationFillMode: "forwards",
            }}
          >
            {/* Asset header row */}
            <div className="p-4 md:p-5">
              <div className="flex flex-col gap-4">
                {/* Top row: name + actions */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-sm tracking-wide">
                          {asset.ticker}
                        </span>
                        <span className="font-medium truncate">{asset.name}</span>
                        <AssetBadge assetType={asset.assetType} isCommodity={isCommodityAsset} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <AddTransactionDialog assets={[asset]} defaultTicker={asset.ticker} commodityTickers={commodityTickers}>
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                        <PlusCircle className="w-3.5 h-3.5" />
                        Transactie
                      </Button>
                    </AddTransactionDialog>
                    <EditAssetDialog
                      asset={asset}
                      ongoingCostsEnabled={!!ongoingCostsMap[asset.ticker]}
                      terValue={terMap[asset.ticker]}
                      updateOngoingCosts={updateOngoingCosts}
                      updateTer={updateTer}
                      isCommodity={isCommodityAsset}
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        title="Bewerken"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </EditAssetDialog>
                    <DeleteAssetButton asset={asset} />
                  </div>
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <MetricCell
                    label="Stuks in bezit"
                    value={
                      <span className="num font-medium">
                        {formatQuantity(fifo.currentQuantity, isCrypto)}
                      </span>
                    }
                  />
                  <MetricCell
                    label="Inleg"
                    value={<MoneyValue amount={fifo.netInvested} className="font-medium" />}
                  />
                  <MetricCell
                    label="Actuele waarde"
                    value={<MoneyValue amount={currentValue} className="font-medium" />}
                  />
                  <MetricCell
                    label="Ongerealiseerd"
                    value={
                      <ReturnValue
                        amount={fifo.unrealized}
                        percentage={
                          fifo.netInvested > 0
                            ? (fifo.unrealized / fifo.netInvested) * 100
                            : undefined
                        }
                        className="font-medium"
                      />
                    }
                  />
                  <MetricCell
                    label="Gerealiseerd"
                    value={<ReturnValue amount={fifo.realized} className="font-medium" />}
                  />
                  <MetricCell
                    label="Huidige prijs"
                    value={
                      <span className="num text-muted-foreground">
                        {formatEuro(asset.currentPrice, 4)}
                      </span>
                    }
                  />
                  {totalTxFees > 0 && (
                    <MetricCell
                      label="Totale transactiekosten"
                      value={
                        <span className="num font-medium text-loss">
                          -{formatEuro(totalTxFees)}
                        </span>
                      }
                    />
                  )}
                  {isStock && !isCommodityAsset && hasTer && totalTerCosts > 0 && (
                    <MetricCell
                      label="Lopende kosten (TER)"
                      value={
                        <span className="num font-medium text-loss">
                          -{formatEuro(totalTerCosts)}
                        </span>
                      }
                    />
                  )}
                </div>

                {/* TER field — stocks (not commodities) with ongoing costs enabled only */}
                {isStock && !isCommodityAsset && ongoingCostsMap[asset.ticker] && (
                  <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                      TER (lopende kosten):
                    </span>
                    {isEditingTer ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="5"
                          placeholder="0,00"
                          value={terEdit.value}
                          onChange={(e) =>
                            setTerEdit((p) => (p ? { ...p, value: e.target.value } : null))
                          }
                          className="h-6 w-20 text-xs px-2"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveTerEdit(asset.ticker);
                            if (e.key === "Escape") cancelTerEdit();
                          }}
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                        <button
                          type="button"
                          onClick={() => saveTerEdit(asset.ticker)}
                          className="text-gain hover:opacity-70 transition-opacity"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelTerEdit}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startTerEdit(asset.ticker)}
                        className="flex items-center gap-1 text-xs hover:text-foreground transition-colors group"
                        title="TER aanpassen"
                      >
                        <span
                          className={cn(
                            "num",
                            hasTer ? "text-foreground" : "text-muted-foreground"
                          )}
                        >
                          {hasTer ? `${terValue.toFixed(2).replace(".", ",")}%` : "Niet ingesteld"}
                        </span>
                        <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Transaction history */}
            {asset.transactions.length > 0 && (
              <div
                className={cn(
                  "px-4 md:px-5 pb-4 border-t border-border/50"
                )}
              >
                <TransactionHistory
                  asset={asset}
                  currentPrice={asset.currentPrice}
                  assetType={asset.assetType}
                  terMap={terMap}
                  ticker={asset.ticker}
                  isCommodity={isCommodityAsset}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface MetricCellProps {
  label: string;
  value: React.ReactNode;
}

function MetricCell({ label, value }: MetricCellProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
        {label}
      </span>
      <div className="text-sm">{value}</div>
    </div>
  );
}
