import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AssetView, AssetType, TransactionType } from "../backend.d";
import { useAddTransaction } from "../hooks/useQueries";
import { calculateFifo } from "../utils/fifo";
import { dateToBigintNano, dateInputToDate, todayInputValue, formatQuantity } from "../utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddTransactionDialogProps {
  assets: AssetView[];
  defaultTicker?: string;
  children?: React.ReactNode;
}

const INITIAL_FORM = {
  ticker: "",
  transactionType: TransactionType.buy as TransactionType,
  date: todayInputValue(),
  quantity: "",
  pricePerUnit: "",
  fees: "",
  hasOngoingCosts: false,
  notes: "",
};

export function AddTransactionDialog({
  assets,
  defaultTicker,
  children,
}: AddTransactionDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...INITIAL_FORM, ticker: defaultTicker ?? "" });
  const addTransaction = useAddTransaction();

  useEffect(() => {
    if (open) {
      setForm({ ...INITIAL_FORM, ticker: defaultTicker ?? "" });
    }
  }, [open, defaultTicker]);

  const selectedAsset = assets.find((a) => a.ticker === form.ticker);
  const isCrypto = selectedAsset?.assetType === AssetType.crypto;
  const isStock = selectedAsset?.assetType === AssetType.stock;
  const isStaking = form.transactionType === TransactionType.stakingReward;

  // Calculate available balance for sell validation
  const availableBalance =
    selectedAsset && form.transactionType === TransactionType.sell
      ? calculateFifo(selectedAsset.transactions, selectedAsset.currentPrice).currentQuantity
      : null;

  const quantity = parseFloat(form.quantity.replace(",", "."));
  const isQuantityExceeded =
    availableBalance !== null && !isNaN(quantity) && quantity > availableBalance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.ticker) {
      toast.error("Selecteer een asset");
      return;
    }

    const qty = parseFloat(form.quantity.replace(",", "."));
    if (isNaN(qty) || qty <= 0) {
      toast.error("Ongeldig aantal stuks");
      return;
    }

    const price = isStaking ? 0 : parseFloat(form.pricePerUnit.replace(",", "."));
    if (!isStaking && (isNaN(price) || price < 0)) {
      toast.error("Ongeldige prijs per stuk");
      return;
    }

    const fees = form.fees ? parseFloat(form.fees.replace(",", ".")) : undefined;
    if (form.fees && isNaN(fees!)) {
      toast.error("Ongeldige transactiekosten");
      return;
    }

    if (isQuantityExceeded) {
      toast.error(
        `Onvoldoende saldo: beschikbaar ${formatQuantity(availableBalance!, isCrypto)} stuks`
      );
      return;
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
        hasOngoingCosts: !isStaking ? form.hasOngoingCosts : undefined,
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
          <DialogTitle className="font-semibold">Transactie toevoegen</DialogTitle>
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
                      <span className="font-mono font-semibold text-xs">{asset.ticker}</span>
                      <span className="text-muted-foreground">{asset.name}</span>
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
                setForm((p) => ({ ...p, transactionType: v as TransactionType }))
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

          {/* Quantity */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-qty">
              Aantal stuks <span className="text-loss">*</span>
            </Label>
            <div className="relative">
              <Input
                id="tx-qty"
                type="number"
                step="any"
                min="0.00000001"
                placeholder={isCrypto ? "0.00000000" : "0,0000"}
                value={form.quantity}
                onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                className={cn(isQuantityExceeded && "border-loss focus-visible:ring-loss")}
                required
              />
            </div>
            {availableBalance !== null && (
              <p
                className={cn(
                  "text-xs flex items-center gap-1",
                  isQuantityExceeded ? "text-loss" : "text-muted-foreground"
                )}
              >
                {isQuantityExceeded && <AlertCircle className="w-3 h-3" />}
                Beschikbaar saldo: {formatQuantity(availableBalance, isCrypto)} stuks
              </p>
            )}
          </div>

          {/* Price per unit — not for staking */}
          {!isStaking && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tx-price">
                Prijs per stuk (€) <span className="text-loss">*</span>
              </Label>
              <Input
                id="tx-price"
                type="number"
                step="0.000001"
                min="0"
                placeholder="0,000000"
                value={form.pricePerUnit}
                onChange={(e) =>
                  setForm((p) => ({ ...p, pricePerUnit: e.target.value }))
                }
                required={!isStaking}
              />
            </div>
          )}

          {/* Fees — not for staking */}
          {!isStaking && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tx-fees">Transactiekosten (€)</Label>
              <Input
                id="tx-fees"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={form.fees}
                onChange={(e) => setForm((p) => ({ ...p, fees: e.target.value }))}
              />
            </div>
          )}

          {/* Ongoing costs checkbox — not for staking, not for crypto */}
          {!isStaking && isStock && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
                <Checkbox
                  id="tx-ongoing-costs"
                  checked={form.hasOngoingCosts}
                  onCheckedChange={(checked) =>
                    setForm((p) => ({ ...p, hasOngoingCosts: checked === true }))
                  }
                  className="mt-0.5"
                />
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="tx-ongoing-costs" className="cursor-pointer font-medium text-sm">
                    Lopende kosten van toepassing
                  </Label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Vink aan als deze positie meetelt voor jaarlijkse lopende kosten berekening
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-notes">Notitie</Label>
            <Textarea
              id="tx-notes"
              placeholder="Optionele notitie…"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
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
              disabled={addTransaction.isPending || isQuantityExceeded}
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
