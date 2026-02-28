import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { LoanStatus, type LoanView } from "../../backend.d";
import { useUpdateLoan } from "../../hooks/useQueries";
import {
  dateInputToDate,
  dateToBigintNano,
  dateToInputValue,
  timeToDate,
} from "../../utils/format";
import { LoanFormFields } from "./LoanFormFields";

export function EditLoanDialog({
  loan,
  children,
}: {
  loan: LoanView;
  children?: React.ReactNode;
}) {
  const buildForm = () => ({
    name: loan.name,
    startDate: dateToInputValue(timeToDate(loan.startDate)),
    loanedAmount: String(loan.loanedAmount),
    interestRatePercent:
      loan.interestRatePercent !== undefined
        ? String(loan.interestRatePercent)
        : "",
    endDate:
      loan.endDate !== undefined
        ? dateToInputValue(timeToDate(loan.endDate))
        : "",
    durationMonths:
      loan.durationMonths !== undefined ? String(loan.durationMonths) : "",
    notes: loan.notes ?? "",
    status: loan.status,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(buildForm);
  const updateLoan = useUpdateLoan();

  const handleOpen = (v: boolean) => {
    if (v) setForm(buildForm());
    setOpen(v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Naam is verplicht");
      return;
    }
    const amount = Number.parseFloat(form.loanedAmount.replace(",", "."));
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error("Voer een geldig bedrag in");
      return;
    }
    const startDate = dateToBigintNano(dateInputToDate(form.startDate));
    const interestRate = form.interestRatePercent
      ? Number.parseFloat(form.interestRatePercent.replace(",", "."))
      : undefined;
    const endDate = form.endDate
      ? dateToBigintNano(dateInputToDate(form.endDate))
      : undefined;
    const durationMonths = form.durationMonths
      ? BigInt(Number.parseInt(form.durationMonths))
      : undefined;

    try {
      await updateLoan.mutateAsync({
        id: loan.id,
        name: form.name.trim(),
        startDate,
        loanedAmount: amount,
        interestRatePercent: interestRate,
        endDate,
        durationMonths,
        notes: form.notes.trim() || undefined,
        status: form.status,
      });
      toast.success("Lening bijgewerkt");
      setOpen(false);
    } catch {
      toast.error("Fout bij het bijwerken van lening");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lening bewerken</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <LoanFormFields
            form={form}
            setForm={setForm as any}
            idPrefix="edit-"
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-loan-status">Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) =>
                setForm((p) => ({ ...p, status: v as LoanStatus }))
              }
            >
              <SelectTrigger id="edit-loan-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={LoanStatus.active}>Actief</SelectItem>
                <SelectItem value={LoanStatus.repaid}>Afgelost</SelectItem>
                <SelectItem value={LoanStatus.defaulted}>In gebreke</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annuleren
            </Button>
            <Button type="submit" disabled={updateLoan.isPending}>
              {updateLoan.isPending && (
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
