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
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { LoanTransactionType, type LoanView } from "../../backend.d";
import { useAddLoanTransaction } from "../../hooks/useQueries";
import {
  dateInputToDate,
  dateToBigintNano,
  todayInputValue,
} from "../../utils/format";

export function AddLoanTransactionDialog({
  loan,
  children,
}: {
  loan: LoanView;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    transactionType:
      LoanTransactionType.interestReceived as LoanTransactionType,
    date: todayInputValue(),
    amount: "",
    notes: "",
  });
  const addLoanTransaction = useAddLoanTransaction();

  const handleOpen = (v: boolean) => {
    if (v) {
      setForm({
        transactionType: LoanTransactionType.interestReceived,
        date: todayInputValue(),
        amount: "",
        notes: "",
      });
    }
    setOpen(v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number.parseFloat(form.amount.replace(",", "."));
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error("Voer een geldig bedrag in");
      return;
    }
    const date = dateToBigintNano(dateInputToDate(form.date));
    try {
      await addLoanTransaction.mutateAsync({
        loanId: loan.id,
        transactionType: form.transactionType,
        date,
        amount,
        notes: form.notes.trim() || undefined,
      });
      toast.success(
        form.transactionType === LoanTransactionType.interestReceived
          ? "Rente geregistreerd"
          : "Aflossing geregistreerd",
      );
      setOpen(false);
    } catch {
      toast.error("Fout bij het toevoegen van transactie");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Transactie
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transactie toevoegen — {loan.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="loan-tx-type">Type</Label>
            <Select
              value={form.transactionType}
              onValueChange={(v) =>
                setForm((p) => ({
                  ...p,
                  transactionType: v as LoanTransactionType,
                }))
              }
            >
              <SelectTrigger id="loan-tx-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={LoanTransactionType.interestReceived}>
                  Rente ontvangen
                </SelectItem>
                <SelectItem value={LoanTransactionType.repaymentReceived}>
                  Aflossing ontvangen
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="loan-tx-date">
              Datum <span className="text-loss">*</span>
            </Label>
            <Input
              id="loan-tx-date"
              type="date"
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="loan-tx-amount">
              Bedrag (€) <span className="text-loss">*</span>
            </Label>
            <Input
              id="loan-tx-amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              value={form.amount}
              onChange={(e) =>
                setForm((p) => ({ ...p, amount: e.target.value }))
              }
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="loan-tx-notes">Notitie</Label>
            <Textarea
              id="loan-tx-notes"
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
            <Button type="submit" disabled={addLoanTransaction.isPending}>
              {addLoanTransaction.isPending && (
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
