import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { calcDurationMonths, formatDuration } from "../../utils/loanHelpers";

interface LoanFormState {
  name: string;
  startDate: string;
  loanedAmount: string;
  interestRatePercent: string;
  endDate: string;
  durationMonths: string;
  notes: string;
}

interface LoanFormFieldsProps {
  form: LoanFormState;
  setForm: React.Dispatch<React.SetStateAction<LoanFormState>>;
  idPrefix?: string;
}

export function LoanFormFields({
  form,
  setForm,
  idPrefix = "",
}: LoanFormFieldsProps) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}loan-name`}>
          Naam <span className="text-loss">*</span>
        </Label>
        <Input
          id={`${idPrefix}loan-name`}
          placeholder="bijv. Jan Jansen of Mintos"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}loan-start`}>
          Startdatum <span className="text-loss">*</span>
        </Label>
        <Input
          id={`${idPrefix}loan-start`}
          type="date"
          value={form.startDate}
          onChange={(e) => {
            const startDate = e.target.value;
            const months = calcDurationMonths(startDate, form.endDate);
            setForm((p) => ({
              ...p,
              startDate,
              durationMonths:
                months !== null ? String(months) : p.durationMonths,
            }));
          }}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}loan-amount`}>
          Uitgeleend bedrag (€) <span className="text-loss">*</span>
        </Label>
        <Input
          id={`${idPrefix}loan-amount`}
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0,00"
          value={form.loanedAmount}
          onChange={(e) =>
            setForm((p) => ({ ...p, loanedAmount: e.target.value }))
          }
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}loan-rate`}>
          Rentepercentage per jaar (%)
        </Label>
        <Input
          id={`${idPrefix}loan-rate`}
          type="number"
          step="0.01"
          min="0"
          placeholder="bijv. 5,00"
          value={form.interestRatePercent}
          onChange={(e) =>
            setForm((p) => ({ ...p, interestRatePercent: e.target.value }))
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}loan-end`}>Einddatum</Label>
          <Input
            id={`${idPrefix}loan-end`}
            type="date"
            value={form.endDate}
            onChange={(e) => {
              const endDate = e.target.value;
              const months = calcDurationMonths(form.startDate, endDate);
              setForm((p) => ({
                ...p,
                endDate,
                durationMonths:
                  months !== null ? String(months) : p.durationMonths,
              }));
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}loan-duration`}>Looptijd (maanden)</Label>
          <Input
            id={`${idPrefix}loan-duration`}
            type="number"
            min="1"
            placeholder="bijv. 24"
            value={form.durationMonths}
            onChange={(e) =>
              setForm((p) => ({ ...p, durationMonths: e.target.value }))
            }
          />
          {form.durationMonths &&
            !Number.isNaN(Number.parseInt(form.durationMonths)) && (
              <span className="text-xs text-muted-foreground">
                {formatDuration(Number.parseInt(form.durationMonths))}
              </span>
            )}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}loan-notes`}>Notities</Label>
        <Textarea
          id={`${idPrefix}loan-notes`}
          placeholder="Optionele notitie…"
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          rows={2}
          className="resize-none"
        />
      </div>
    </>
  );
}
