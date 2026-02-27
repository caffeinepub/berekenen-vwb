import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { AssetView, AssetType, TransactionView, TransactionType } from "../backend.d";
import { useUpdateTransaction } from "../hooks/useQueries";
import { calculateFifo } from "../utils/fifo";
import {
  dateToBigintNano,
  dateInputToDate,
  timeToDate,
  formatQuantity,
  dateToInputValue,
} from "../utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditTransactionDialogProps {
  asset: AssetView;
  transactionIndex: number;
  transaction: TransactionView;
  children?: React.ReactNode;
  isCommodity?: boolean;
}

export function EditTransactionDialog({
  asset,
  transactionIndex,
  transaction,
  children,
  isCommodity = false,
}: EditTransactionDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    transactionType: transaction.transactionType,
    date: dateToInputValue(timeToDate(transaction.date)),
    quantity: String(transaction.quantity),
    pricePerUnit: String(transaction.pricePerUnit),
    fees: transaction.fees != null ? String(transaction.fees) : "",
    hasOngoingCosts: transaction.hasOngoingCosts ?? false,
    notes: transaction.notes ?? "",
    euroValue: transaction.euroValue != null ? String(transaction.euroValue) : "",
    stakingEuroValue: transaction.transactionType === TransactionType.stakingReward && transaction.euroValue != null
      ? String(transaction.euroValue)
      : "",
  });
  const updateTransaction = useUpdateTransaction();
  const sellPriceAutoFilled = useRef(false);

  const isCrypto = asset.assetType === AssetType.crypto;
  const isStaking = form.transactionType === TransactionType.stakingReward;
  const isDividend = form.transactionType === TransactionType.dividend;

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      sellPriceAutoFilled.current = false;
      setForm({
        transactionType: transaction.transactionType,
        date: dateToInputValue(timeToDate(transaction.date)),
        quantity: String(transaction.quantity),
        pricePerUnit: String(transaction.pricePerUnit),
        fees: transaction.fees != null ? String(transaction.fees) : "",
        hasOngoingCosts: transaction.hasOngoingCosts ?? false,
        notes: transaction.notes ?? "",
        euroValue: transaction.euroValue != null ? String(transaction.euroValue) : "",
        stakingEuroValue: transaction.transactionType === TransactionType.stakingReward && transaction.euroValue != null
          ? String(transaction.euroValue)
          : "",
      });
    }
    setOpen(isOpen);
  };

  // Auto-fill sell price when switching to sell type
  useEffect(() => {
    if (
      form.transactionType === TransactionType.sell &&
      asset.currentPrice > 0 &&
      !sellPriceAutoFilled.current &&
      (!form.pricePerUnit || form.pricePerUnit === "0")
    ) {
      setForm((p) => ({ ...p, pricePerUnit: String(asset.currentPrice) }));
      sellPriceAutoFilled.current = true;
    } else if (form.transactionType !== TransactionType.sell) {
      sellPriceAutoFilled.current = false;
    }
  }, [form.transactionType, asset.currentPrice, form.pricePerUnit]);

  // Calculate available balance for sell validation (excluding current transaction if it was a buy)
  const otherTransactions = asset.transactions.filter((_, i) => {
    const origIdx = asset.transactions.indexOf(transaction);
    return i !== origIdx;
  });

  const availableBalance =
    form.transactionType === TransactionType.sell
      ? calculateFifo(otherTransactions, asset.currentPrice).currentQuantity
      : null;

  const quantity = parseFloat(form.quantity.replace(",", "."));
  const isQuantityExceeded =
    availableBalance !== null && !isNaN(quantity) && quantity > availableBalance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const dateObj = dateInputToDate(form.date);
    const dateBigint = dateToBigintNano(dateObj);

    // Dividend: only needs euroValue
    if (isDividend) {
      const parsedEuroValue = parseFloat(form.euroValue.replace(",", "."));
      if (isNaN(parsedEuroValue) || parsedEuroValue <= 0) {
        toast.error("Ongeldig ontvangen bedrag");
        return;
      }
      try {
        await updateTransaction.mutateAsync({
          ticker: asset.ticker,
          index: transactionIndex,
          transaction: {
            asset: asset.ticker,
            transactionType: form.transactionType,
            date: dateBigint,
            quantity: 0,
            pricePerUnit: 0,
            fees: undefined,
            euroValue: parsedEuroValue,
            notes: form.notes.trim() || undefined,
          },
        });
        toast.success("Transactie bijgewerkt");
        setOpen(false);
      } catch {
        toast.error("Fout bij het bijwerken van transactie");
      }
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

    // Staking: also requires euro value
    let stakingEuro: number | undefined;
    if (isStaking) {
      const parsed = parseFloat(form.stakingEuroValue.replace(",", "."));
      if (isNaN(parsed) || parsed < 0) {
        toast.error("Ongeldige eurowaarde voor staking");
        return;
      }
      stakingEuro = parsed;
    }

    try {
      await updateTransaction.mutateAsync({
        ticker: asset.ticker,
        index: transactionIndex,
        transaction: {
          asset: asset.ticker,
          transactionType: form.transactionType,
          date: dateBigint,
          quantity: qty,
          pricePerUnit: isStaking ? 0 : price,
          fees: fees,
          euroValue: isStaking ? stakingEuro : undefined,
          hasOngoingCosts: !isStaking && !isDividend ? form.hasOngoingCosts : undefined,
          notes: form.notes.trim() || undefined,
        },
      });
      toast.success("Transactie bijgewerkt");
      setOpen(false);
    } catch {
      toast.error("Fout bij het bijwerken van transactie");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-semibold">Transactie bewerken</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          {/* Transaction type */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-tx-type">Type</Label>
            <Select
              value={form.transactionType}
              onValueChange={(v) =>
                setForm((p) => ({ ...p, transactionType: v as TransactionType }))
              }
            >
              <SelectTrigger id="edit-tx-type">
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
                {!isCrypto && (
                  <SelectItem value={TransactionType.dividend}>
                    Dividend
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-tx-date">
              Datum <span className="text-loss">*</span>
            </Label>
            <Input
              id="edit-tx-date"
              type="date"
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              required
            />
          </div>

          {/* Dividend: only show euro value field */}
          {isDividend && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-tx-euro-value">
                Ontvangen bedrag (€) <span className="text-loss">*</span>
              </Label>
              <Input
                id="edit-tx-euro-value"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                value={form.euroValue}
                onChange={(e) => setForm((p) => ({ ...p, euroValue: e.target.value }))}
                required
              />
            </div>
          )}

          {/* Quantity — not for dividend */}
          {!isDividend && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-tx-qty">
                {isCrypto ? "Hoeveelheid" : isCommodity ? "Aantal eenheden" : "Aantal stuks"} <span className="text-loss">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="edit-tx-qty"
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
          )}

          {/* Price per unit — not for staking or dividend */}
          {!isStaking && !isDividend && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-tx-price">
                {isCommodity ? "Prijs per eenheid (€)" : "Prijs per stuk (€)"} <span className="text-loss">*</span>
              </Label>
              <Input
                id="edit-tx-price"
                type="number"
                step="0.000001"
                min="0"
                placeholder="0,000000"
                value={form.pricePerUnit}
                onChange={(e) => {
                  sellPriceAutoFilled.current = true; // user manually edited
                  setForm((p) => ({ ...p, pricePerUnit: e.target.value }));
                }}
                required={!isStaking && !isDividend}
              />
            </div>
          )}

          {/* Staking: euro value at receipt */}
          {isStaking && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-tx-staking-euro">
                Waarde in euro op moment van ontvangst (€) <span className="text-loss">*</span>
              </Label>
              <Input
                id="edit-tx-staking-euro"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={form.stakingEuroValue}
                onChange={(e) => setForm((p) => ({ ...p, stakingEuroValue: e.target.value }))}
                required
              />
            </div>
          )}

          {/* Fees — not for staking or dividend */}
          {!isStaking && !isDividend && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-tx-fees">Transactiekosten (€)</Label>
              <Input
                id="edit-tx-fees"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={form.fees}
                onChange={(e) => setForm((p) => ({ ...p, fees: e.target.value }))}
              />
            </div>
          )}


          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-tx-notes">Notitie</Label>
            <Textarea
              id="edit-tx-notes"
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
              disabled={updateTransaction.isPending || (!isDividend && isQuantityExceeded)}
            >
              {updateTransaction.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Opslaan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
