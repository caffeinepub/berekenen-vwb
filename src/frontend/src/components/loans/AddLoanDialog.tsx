import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAddLoan } from "../../hooks/useQueries";
import {
  dateInputToDate,
  dateToBigintNano,
  todayInputValue,
} from "../../utils/format";
import { LoanFormFields } from "./LoanFormFields";

const EMPTY_LOAN_FORM = {
  name: "",
  startDate: todayInputValue(),
  loanedAmount: "",
  interestRatePercent: "",
  endDate: "",
  durationMonths: "",
  notes: "",
};

export function AddLoanDialog({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_LOAN_FORM });
  const addLoan = useAddLoan();

  const handleOpen = (v: boolean) => {
    if (v) setForm({ ...EMPTY_LOAN_FORM });
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
      await addLoan.mutateAsync({
        name: form.name.trim(),
        startDate,
        loanedAmount: amount,
        interestRatePercent: interestRate,
        endDate,
        durationMonths,
        notes: form.notes.trim() || undefined,
      });
      toast.success("Lening toegevoegd");
      setOpen(false);
    } catch {
      toast.error("Fout bij het toevoegen van lening");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" />
            Lening toevoegen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lening toevoegen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <LoanFormFields form={form} setForm={setForm} idPrefix="add-" />
          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annuleren
            </Button>
            <Button type="submit" disabled={addLoan.isPending}>
              {addLoan.isPending && (
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
