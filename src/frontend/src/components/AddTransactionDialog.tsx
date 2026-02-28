import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AlertCircle, Loader2, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AssetType, type AssetView, TransactionType } from "../backend.d";
import { useAddTransaction } from "../hooks/useQueries";
import { calculateFifo } from "../utils/fifo";
import {
  dateInputToDate,
  dateToBigintNano,
  formatQuantity,
  todayInputValue,
} from "../utils/format";

interface AddTransactionDialogProps {
  assets: AssetView[];
  defaultTicker?: string;
  children?: React.ReactNode;
  /** Set of tickers that are commodities — hides dividend option */
  commodityTickers?: Set<string>;
}

const INITIAL_FORM = {
  ticker: "",
  transactionType: TransactionType.buy as TransactionType,
  date: todayInputValue(),
  quantity: "",
  pricePerUnit: "",
  fees: "",
  notes: "",
  euroValue: "",
  stakingEuroValue: "",
};

export function AddTransactionDialog({
  assets,
  defaultTicker,
  children,
  commodityTickers,
}: AddTransactionDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    ...INITIAL_FORM,
    ticker: defaultTicker ?? "",
  });
  const addTransaction = useAddTransaction();
  // Track whether the sell price was auto-filled (so manual edits are preserved)
  const sellPriceAutoFilled = useRef(false);

  useEffect(() => {
    if (open) {
      setForm({ ...INITIAL_FORM, ticker: defaultTicker ?? "" });
      sellPriceAutoFilled.current = false;
    }
  }, [open, defaultTicker]);

  const selectedAsset = assets.find((a) => a.ticker === form.ticker);
  const isCrypto = selectedAsset?.assetType === AssetType.crypto;
  const isCommodity = !!(
    selectedAsset && commodityTickers?.has(selectedAsset.ticker)
  );
  const isStaking = form.transactionType === TransactionType.stakingReward;
  const isDividend = form.transactionType === TransactionType.dividend;

  // Auto-fill sell price with current asset price when switching to sell type
  useEffect(() => {
    if (
      form.transactionType === TransactionType.sell &&
      selectedAsset &&
      selectedAsset.currentPrice > 0 &&
      !sellPriceAutoFilled.current
    ) {
      setForm((p) => ({
        ...p,
        pricePerUnit: String(selectedAsset.currentPrice),
      }));
      sellPriceAutoFilled.current = true;
    } else if (form.transactionType !== TransactionType.sell) {
      sellPriceAutoFilled.current = false;
    }
  }, [form.transactionType, selectedAsset]);

  // Calculate available balance for sell validation
  const availableBalance =
    selectedAsset && form.transactionType === TransactionType.sell
      ? calculateFifo(selectedAsset.transactions, selectedAsset.currentPrice)
          .currentQuantity
      : null;

  const quantity = Number.parseFloat(form.quantity.replace(",", "."));
  const isQuantityExceeded =
    availableBalance !== null &&
    !Number.isNaN(quantity) &&
    quantity > availableBalance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.ticker) {
      toast.error("Selecteer een asset");
      return;
    }

    // Dividend: only needs euroValue
    if (isDividend) {
      const parsedEuroValue = Number.parseFloat(
        form.euroValue.replace(",", "."),
      );
      if (Number.isNaN(parsedEuroValue) || parsedEuroValue <= 0) {
        toast.error("Ongeldig ontvangen bedrag");
        return;
      }
      const dateObj = dateInputToDate(form.date);
      const dateBigint = dateToBigintNano(dateObj);
      try {
        await addTransaction.mutateAsync({
          asset: form.ticker,
          transactionType: form.transactionType,
          date: dateBigint,
          quantity: 0,
          pricePerUnit: 0,
          fees: undefined,
          euroValue: parsedEuroValue,
          notes: form.notes.trim() || undefined,
        });
        toast.success("Dividend toegevoegd");
        setOpen(false);
      } catch {
        toast.error("Fout bij het toevoegen van dividend");
      }
      return;
    }

    const qty = Number.parseFloat(form.quantity.replace(",", "."));
    if (Number.isNaN(qty) || qty <= 0) {
      toast.error("Ongeldig aantal stuks");
      return;
    }

    const price = isStaking
      ? 0
      : Number.parseFloat(form.pricePerUnit.replace(",", "."));
    if (!isStaking && (Number.isNaN(price) || price < 0)) {
      toast.error("Ongeldige prijs per stuk");
      return;
    }

    const fees = form.fees
      ? Number.parseFloat(form.fees.replace(",", "."))
      : undefined;
    if (form.fees && Number.isNaN(fees!)) {
      toast.error("Ongeldige transactiekosten");
      return;
    }

    if (isQuantityExceeded) {
      toast.error(
        `Onvoldoende saldo: beschikbaar ${formatQuantity(availableBalance!, isCrypto)} stuks`,
      );
      return;
    }

    // Staking: also requires a euro value at time of receipt
    let stakingEuro: number | undefined;
    if (isStaking) {
      const parsed = Number.parseFloat(form.stakingEuroValue.replace(",", "."));
      if (Number.isNaN(parsed) || parsed < 0) {
        toast.error("Ongeldige eurowaarde voor staking");
        return;
      }
      stakingEuro = parsed;
    }

    const dateObj = dateInputToDate(form.date);
    const dateBigint = dateToBigintNano(dateObj);

    try {
      await addTransaction.mutateAsync({
        asset: form.ticker,
        transactionType: form.transactionType,
        date: dateBigint,
        quantity: qty,
        pricePerUnit: isStaking ? 0 : price,
        fees: fees,
        euroValue: isStaking ? stakingEuro : undefined,
        notes: form.notes.trim() || undefined,
      });
      toast.success("Transactie toegevoegd");
      setOpen(false);
    } catch {
      toast.error("Fout bij het toevoegen van transactie");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button size="sm" variant="outline">
            <Plus className="w-4 h-4 mr-1.5" />
            Transactie
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-semibold">
            Transactie toevoegen
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          {/* Asset */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-asset">
              Asset <span className="text-loss">*</span>
            </Label>
            <Select
              value={form.ticker}
              onValueChange={(v) => setForm((p) => ({ ...p, ticker: v }))}
            >
              <SelectTrigger id="tx-asset">
                <SelectValue placeholder="Selecteer asset…" />
              </SelectTrigger>
              <SelectContent>
                {assets.map((asset) => (
                  <SelectItem key={asset.ticker} value={asset.ticker}>
                    <span className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-xs">
                        {asset.ticker}
                      </span>
                      <span className="text-muted-foreground">
                        {asset.name}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Transaction type */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-type">Type</Label>
            <Select
              value={form.transactionType}
              onValueChange={(v) =>
                setForm((p) => ({
                  ...p,
                  transactionType: v as TransactionType,
                }))
              }
            >
              <SelectTrigger id="tx-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TransactionType.buy}>Aankoop</SelectItem>
                <SelectItem value={TransactionType.sell}>Verkoop</SelectItem>
                {isCrypto && (
                  <SelectItem value={TransactionType.stakingReward}>
                    Staking reward
                  </SelectItem>
                )}
                {!isCrypto && !isCommodity && (
                  <SelectItem value={TransactionType.dividend}>
                    Dividend
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-date">
              Datum <span className="text-loss">*</span>
            </Label>
            <Input
              id="tx-date"
              type="date"
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              required
            />
          </div>

          {/* Dividend: only show euro value field */}
          {isDividend && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tx-euro-value">
                Ontvangen bedrag (€) <span className="text-loss">*</span>
              </Label>
              <Input
                id="tx-euro-value"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                value={form.euroValue}
                onChange={(e) =>
                  setForm((p) => ({ ...p, euroValue: e.target.value }))
                }
                required
              />
            </div>
          )}

          {/* Quantity — not for dividend */}
          {!isDividend && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tx-qty">
                {isCrypto
                  ? "Hoeveelheid"
                  : isCommodity
                    ? "Aantal eenheden"
                    : "Aantal stuks"}{" "}
                <span className="text-loss">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="tx-qty"
                  type="number"
                  step="any"
                  min="0.00000001"
                  placeholder={isCrypto ? "0.00000000" : "0,0000"}
                  value={form.quantity}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, quantity: e.target.value }))
                  }
                  className={cn(
                    isQuantityExceeded && "border-loss focus-visible:ring-loss",
                  )}
                  required
                />
              </div>
              {availableBalance !== null && (
                <p
                  className={cn(
                    "text-xs flex items-center gap-1",
                    isQuantityExceeded ? "text-loss" : "text-muted-foreground",
                  )}
                >
                  {isQuantityExceeded && <AlertCircle className="w-3 h-3" />}
                  Beschikbaar saldo:{" "}
                  {formatQuantity(availableBalance, isCrypto)} stuks
                </p>
              )}
            </div>
          )}

          {/* Price per unit — not for staking or dividend */}
          {!isStaking && !isDividend && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tx-price">
                {isCommodity ? "Prijs per eenheid (€)" : "Prijs per stuk (€)"}{" "}
                <span className="text-loss">*</span>
              </Label>
              <Input
                id="tx-price"
                type="number"
                step="0.000001"
                min="0"
                placeholder="0,000000"
                value={form.pricePerUnit}
                onChange={(e) => {
                  sellPriceAutoFilled.current = true; // user manually edited — lock it
                  setForm((p) => ({ ...p, pricePerUnit: e.target.value }));
                }}
                required={!isStaking && !isDividend}
              />
            </div>
          )}

          {/* Staking: euro value at receipt */}
          {isStaking && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tx-staking-euro">
                Waarde in euro op moment van ontvangst (€){" "}
                <span className="text-loss">*</span>
              </Label>
              <Input
                id="tx-staking-euro"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={form.stakingEuroValue}
                onChange={(e) =>
                  setForm((p) => ({ ...p, stakingEuroValue: e.target.value }))
                }
                required
              />
            </div>
          )}

          {/* Fees — not for staking or dividend */}
          {!isStaking && !isDividend && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tx-fees">Transactiekosten (€)</Label>
              <Input
                id="tx-fees"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={form.fees}
                onChange={(e) =>
                  setForm((p) => ({ ...p, fees: e.target.value }))
                }
              />
            </div>
          )}

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-notes">Notitie</Label>
            <Textarea
              id="tx-notes"
              placeholder="Optionele notitie…"
              value={form.notes}
              onChange={(e) =>
                setForm((p) => ({ ...p, notes: e.target.value }))
              }
              rows={2}
              className="resize-none"
            />
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annuleren
            </Button>
            <Button
              type="submit"
              disabled={
                addTransaction.isPending || (!isDividend && isQuantityExceeded)
              }
            >
              {addTransaction.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Toevoegen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
