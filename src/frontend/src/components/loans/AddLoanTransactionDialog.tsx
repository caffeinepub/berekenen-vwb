import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Loader2, Plus, RepeatIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LoanTransactionType, type LoanView } from "../../backend.d";
import { useAddLoanTransaction } from "../../hooks/useQueries";
import {
  dateInputToDate,
  dateToBigintNano,
  todayInputValue,
} from "../../utils/format";
import {
  calcMonthlyInterest,
  loanOutstandingAtDate,
} from "../../utils/loanHelpers";

export interface RecurringLoanSchedule {
  id: string;
  loanId: string; // BigInt as string
  loanName: string;
  transactionType: LoanTransactionType;
  amount: number;
  notes?: string;
  startDate: string;
  endDate: string;
  frequency: "daily" | "weekly" | "monthly";
  lastExecuted?: string;
  /** Automatisch rente registreren bij elke aflossing in deze reeks */
  autoInterest?: boolean;
  /** Jaarlijks rentepercentage, bewaard bij aanmaken zodat de hook het kan gebruiken */
  interestRatePercent?: number;
}

interface LoanTxPrefill {
  transactionType?: LoanTransactionType;
  amount?: number;
  notes?: string;
}

export function AddLoanTransactionDialog({
  loan,
  children,
  prefill,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: {
  loan: LoanView;
  children?: React.ReactNode;
  prefill?: LoanTxPrefill;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isControlled = externalOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? externalOpen : internalOpen;

  const setOpen = (v: boolean) => {
    if (isControlled) {
      externalOnOpenChange?.(v);
    } else {
      setInternalOpen(v);
    }
  };

  const [form, setForm] = useState({
    transactionType:
      LoanTransactionType.interestReceived as LoanTransactionType,
    date: todayInputValue(),
    amount: "",
    notes: "",
  });

  const [recurring, setRecurring] = useState({
    enabled: false,
    startDate: todayInputValue(),
    endDate: "",
    frequency: "monthly" as "daily" | "weekly" | "monthly",
  });

  const [autoInterest, setAutoInterest] = useState(false);

  const addLoanTransaction = useAddLoanTransaction();

  useEffect(() => {
    if (open) {
      setForm({
        transactionType:
          prefill?.transactionType ?? LoanTransactionType.interestReceived,
        date: todayInputValue(),
        amount: prefill?.amount !== undefined ? String(prefill.amount) : "",
        notes: prefill?.notes ?? "",
      });
      setRecurring({
        enabled: false,
        startDate: todayInputValue(),
        endDate: "",
        frequency: "monthly",
      });
      setAutoInterest(false);
    }
  }, [open, prefill]);

  const saveRecurringSchedule = (amount: number) => {
    const key = "portfolioflow_recurring_loans";
    const existing: RecurringLoanSchedule[] = JSON.parse(
      localStorage.getItem(key) ?? "[]",
    );
    const isRepayment =
      form.transactionType === LoanTransactionType.repaymentReceived;
    const schedule: RecurringLoanSchedule = {
      id: Date.now().toString(),
      loanId: loan.id.toString(),
      loanName: loan.name,
      transactionType: form.transactionType,
      amount,
      notes: form.notes.trim() || undefined,
      startDate: recurring.startDate,
      endDate: recurring.endDate,
      frequency: recurring.frequency,
      // Markeer de startdatum als al uitgevoerd, zodat de hook geen
      // dubbele transactie aanmaakt op diezelfde datum.
      lastExecuted: recurring.startDate,
      // Bewaar autoInterest-instelling zodat de hook dit kan toepassen bij elke herhaling
      autoInterest: isRepayment ? autoInterest : false,
      interestRatePercent: loan.interestRatePercent ?? 0,
    };
    localStorage.setItem(key, JSON.stringify([...existing, schedule]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number.parseFloat(form.amount.replace(",", "."));
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error("Voer een geldig bedrag in");
      return;
    }

    if (recurring.enabled && !recurring.endDate) {
      toast.error("Vul een einddatum in voor de herhaling");
      return;
    }

    // Als herhaling is ingeschakeld, gebruik de startdatum van de herhaling
    // als transactiedatum voor de eerste (directe) transactie.
    const txDateStr = recurring.enabled ? recurring.startDate : form.date;
    const txDate = dateInputToDate(txDateStr);
    const dateNano = dateToBigintNano(txDate);

    try {
      await addLoanTransaction.mutateAsync({
        loanId: loan.id,
        transactionType: form.transactionType,
        date: dateNano,
        amount,
        notes: form.notes.trim() || undefined,
      });

      // Automatisch rente registreren bij aflossing (indien ingeschakeld)
      const annualRate = loan.interestRatePercent ?? 0;
      if (
        form.transactionType === LoanTransactionType.repaymentReceived &&
        autoInterest &&
        annualRate > 0
      ) {
        // Bereken uitstaande schuld vóór de huidige aflossing
        const outstanding = loanOutstandingAtDate(loan, txDate);
        const interestAmount = calcMonthlyInterest(outstanding, annualRate);

        if (interestAmount > 0) {
          await addLoanTransaction.mutateAsync({
            loanId: loan.id,
            transactionType: LoanTransactionType.interestReceived,
            date: dateNano,
            amount: Math.round(interestAmount * 100) / 100,
            notes: `Automatische rente bij aflossing (${annualRate}% p.j.)`,
          });
        }
      }

      if (recurring.enabled && recurring.endDate) {
        saveRecurringSchedule(amount);
        toast.success(
          form.transactionType === LoanTransactionType.interestReceived
            ? "Rente geregistreerd en herhaling ingesteld"
            : "Aflossing geregistreerd en herhaling ingesteld",
        );
      } else {
        const isRepayment =
          form.transactionType === LoanTransactionType.repaymentReceived;
        const interestAdded = isRepayment && autoInterest && annualRate > 0;
        toast.success(
          form.transactionType === LoanTransactionType.interestReceived
            ? "Rente geregistreerd"
            : interestAdded
              ? "Aflossing en rente geregistreerd"
              : "Aflossing geregistreerd",
        );
      }
      setOpen(false);
    } catch {
      toast.error("Fout bij het toevoegen van transactie");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          {children ?? (
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Transactie
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {prefill ? "Transactie dupliceren" : "Transactie toevoegen"} —{" "}
            {loan.name}
          </DialogTitle>
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

          {/* Automatisch rente bij aflossing */}
          {form.transactionType === LoanTransactionType.repaymentReceived &&
            (loan.interestRatePercent ?? 0) > 0 && (
              <div className="border border-border rounded-lg p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="loan-tx-auto-interest"
                    checked={autoInterest}
                    onCheckedChange={(checked) => setAutoInterest(!!checked)}
                  />
                  <Label
                    htmlFor="loan-tx-auto-interest"
                    className="flex items-center gap-1.5 cursor-pointer font-medium"
                  >
                    Automatisch rente registreren
                  </Label>
                </div>
                {autoInterest && (
                  <p className="text-xs text-muted-foreground pl-6">
                    De applicatie berekent automatisch maandrente (
                    {loan.interestRatePercent}% p.j.) over de uitstaande schuld
                    vóór deze aflossing en registreert dit als aparte
                    rente-transactie op dezelfde datum.
                  </p>
                )}
              </div>
            )}

          {/* Recurring transaction section */}
          <div className="border border-border rounded-lg p-3 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="loan-tx-recurring"
                checked={recurring.enabled}
                onCheckedChange={(checked) =>
                  setRecurring((p) => ({ ...p, enabled: !!checked }))
                }
              />
              <Label
                htmlFor="loan-tx-recurring"
                className="flex items-center gap-1.5 cursor-pointer font-medium"
              >
                <RepeatIcon className="w-3.5 h-3.5 text-muted-foreground" />
                Stel herhaling in
              </Label>
            </div>

            {recurring.enabled && (
              <div className="flex flex-col gap-3 pl-1">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="loan-rec-start">Startdatum</Label>
                  <Input
                    id="loan-rec-start"
                    type="date"
                    value={recurring.startDate}
                    onChange={(e) =>
                      setRecurring((p) => ({ ...p, startDate: e.target.value }))
                    }
                    required={recurring.enabled}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="loan-rec-end">
                    Einddatum <span className="text-loss">*</span>
                  </Label>
                  <Input
                    id="loan-rec-end"
                    type="date"
                    value={recurring.endDate}
                    onChange={(e) =>
                      setRecurring((p) => ({ ...p, endDate: e.target.value }))
                    }
                    required={recurring.enabled}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="loan-rec-freq">Frequentie</Label>
                  <Select
                    value={recurring.frequency}
                    onValueChange={(v) =>
                      setRecurring((p) => ({
                        ...p,
                        frequency: v as "daily" | "weekly" | "monthly",
                      }))
                    }
                  >
                    <SelectTrigger id="loan-rec-freq">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Dagelijks</SelectItem>
                      <SelectItem value="weekly">Wekelijks</SelectItem>
                      <SelectItem value="monthly">Maandelijks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
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
