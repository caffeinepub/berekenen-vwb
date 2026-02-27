import { useState } from "react";
import { toast } from "sonner";
import { LoanView, LoanStatus, LoanTransactionType } from "../backend.d";
import {
  useAllLoans,
  useAddLoan,
  useUpdateLoan,
  useDeleteLoan,
  useAddLoanTransaction,
  useDeleteLoanTransaction,
} from "../hooks/useQueries";
import {
  dateToBigintNano,
  dateInputToDate,
  todayInputValue,
  formatDate,
  formatEuro,
  dateToInputValue,
  timeToDate,
} from "../utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  Plus,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Inbox,
  Wallet,
  TrendingUp,
  ArrowDownToLine,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Duration helpers ─────────────────────────────────────────────────────────

function calcDurationMonths(startDateStr: string, endDateStr: string): number | null {
  if (!startDateStr || !endDateStr) return null;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

function formatDuration(months: number | bigint): string {
  const m = typeof months === "bigint" ? Number(months) : months;
  if (m <= 0) return "";
  const years = Math.floor(m / 12);
  const rem = m % 12;
  if (years === 0) return `${m} maand${m !== 1 ? "en" : ""}`;
  if (rem === 0) return `${years} jaar`;
  return `${years} jaar en ${rem} maand${rem !== 1 ? "en" : ""}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loanOutstanding(loan: LoanView): number {
  const totalRepaid = loan.transactions
    .filter((t) => t.transactionType === LoanTransactionType.repaymentReceived)
    .reduce((s, t) => s + t.amount, 0);
  return Math.max(0, loan.loanedAmount - totalRepaid);
}

function loanTotalInterest(loan: LoanView): number {
  return loan.transactions
    .filter((t) => t.transactionType === LoanTransactionType.interestReceived)
    .reduce((s, t) => s + t.amount, 0);
}

function loanTotalRepaid(loan: LoanView): number {
  return loan.transactions
    .filter((t) => t.transactionType === LoanTransactionType.repaymentReceived)
    .reduce((s, t) => s + t.amount, 0);
}

function statusLabel(status: LoanStatus): string {
  switch (status) {
    case LoanStatus.active:
      return "Actief";
    case LoanStatus.repaid:
      return "Afgelost";
    case LoanStatus.defaulted:
      return "In gebreke";
  }
}

function statusColor(status: LoanStatus): string {
  switch (status) {
    case LoanStatus.active:
      return "border-gain/40 text-gain bg-gain/10";
    case LoanStatus.repaid:
      return "border-primary/40 text-primary bg-primary/10";
    case LoanStatus.defaulted:
      return "border-loss/40 text-loss bg-loss/10";
  }
}

// ─── Summary cards ────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className="text-muted-foreground/50">{icon}</span>
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

// ─── Add Loan Dialog ──────────────────────────────────────────────────────────

const EMPTY_LOAN_FORM = {
  name: "",
  startDate: todayInputValue(),
  loanedAmount: "",
  interestRatePercent: "",
  endDate: "",
  durationMonths: "",
  notes: "",
};

function AddLoanDialog({ children }: { children?: React.ReactNode }) {
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
    const amount = parseFloat(form.loanedAmount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) {
      toast.error("Voer een geldig bedrag in");
      return;
    }
    const startDate = dateToBigintNano(dateInputToDate(form.startDate));
    const interestRate = form.interestRatePercent
      ? parseFloat(form.interestRatePercent.replace(",", "."))
      : undefined;
    const endDate = form.endDate
      ? dateToBigintNano(dateInputToDate(form.endDate))
      : undefined;
    const durationMonths = form.durationMonths
      ? BigInt(parseInt(form.durationMonths))
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="loan-name">
              Naam <span className="text-loss">*</span>
            </Label>
            <Input
              id="loan-name"
              placeholder="bijv. Jan Jansen of Mintos"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="loan-start">
              Startdatum <span className="text-loss">*</span>
            </Label>
            <Input
              id="loan-start"
              type="date"
              value={form.startDate}
              onChange={(e) => {
                const startDate = e.target.value;
                const months = calcDurationMonths(startDate, form.endDate);
                setForm((p) => ({
                  ...p,
                  startDate,
                  durationMonths: months !== null ? String(months) : p.durationMonths,
                }));
              }}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="loan-amount">
              Uitgeleend bedrag (€) <span className="text-loss">*</span>
            </Label>
            <Input
              id="loan-amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              value={form.loanedAmount}
              onChange={(e) => setForm((p) => ({ ...p, loanedAmount: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="loan-rate">Rentepercentage per jaar (%)</Label>
            <Input
              id="loan-rate"
              type="number"
              step="0.01"
              min="0"
              placeholder="bijv. 5,00"
              value={form.interestRatePercent}
              onChange={(e) => setForm((p) => ({ ...p, interestRatePercent: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="loan-end">Einddatum</Label>
              <Input
                id="loan-end"
                type="date"
                value={form.endDate}
                onChange={(e) => {
                  const endDate = e.target.value;
                  const months = calcDurationMonths(form.startDate, endDate);
                  setForm((p) => ({
                    ...p,
                    endDate,
                    durationMonths: months !== null ? String(months) : p.durationMonths,
                  }));
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="loan-duration">Looptijd (maanden)</Label>
              <Input
                id="loan-duration"
                type="number"
                min="1"
                placeholder="bijv. 24"
                value={form.durationMonths}
                onChange={(e) => setForm((p) => ({ ...p, durationMonths: e.target.value }))}
              />
              {form.durationMonths && !isNaN(parseInt(form.durationMonths)) && (
                <span className="text-xs text-muted-foreground">
                  {formatDuration(parseInt(form.durationMonths))}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="loan-notes">Notities</Label>
            <Textarea
              id="loan-notes"
              placeholder="Optionele notitie…"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="resize-none"
            />
          </div>
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <Button type="submit" disabled={addLoan.isPending}>
              {addLoan.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Toevoegen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Loan Dialog ─────────────────────────────────────────────────────────

function EditLoanDialog({
  loan,
  children,
}: {
  loan: LoanView;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: loan.name,
    startDate: dateToInputValue(timeToDate(loan.startDate)),
    loanedAmount: String(loan.loanedAmount),
    interestRatePercent: loan.interestRatePercent !== undefined ? String(loan.interestRatePercent) : "",
    endDate: loan.endDate !== undefined ? dateToInputValue(timeToDate(loan.endDate)) : "",
    durationMonths: loan.durationMonths !== undefined ? String(loan.durationMonths) : "",
    notes: loan.notes ?? "",
    status: loan.status,
  });
  const updateLoan = useUpdateLoan();

  const handleOpen = (v: boolean) => {
    if (v) {
      setForm({
        name: loan.name,
        startDate: dateToInputValue(timeToDate(loan.startDate)),
        loanedAmount: String(loan.loanedAmount),
        interestRatePercent:
          loan.interestRatePercent !== undefined ? String(loan.interestRatePercent) : "",
        endDate: loan.endDate !== undefined ? dateToInputValue(timeToDate(loan.endDate)) : "",
        durationMonths:
          loan.durationMonths !== undefined ? String(loan.durationMonths) : "",
        notes: loan.notes ?? "",
        status: loan.status,
      });
    }
    setOpen(v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Naam is verplicht");
      return;
    }
    const amount = parseFloat(form.loanedAmount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) {
      toast.error("Voer een geldig bedrag in");
      return;
    }
    const startDate = dateToBigintNano(dateInputToDate(form.startDate));
    const interestRate = form.interestRatePercent
      ? parseFloat(form.interestRatePercent.replace(",", "."))
      : undefined;
    const endDate = form.endDate
      ? dateToBigintNano(dateInputToDate(form.endDate))
      : undefined;
    const durationMonths = form.durationMonths
      ? BigInt(parseInt(form.durationMonths))
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-loan-name">
              Naam <span className="text-loss">*</span>
            </Label>
            <Input
              id="edit-loan-name"
              placeholder="bijv. Jan Jansen of Mintos"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-loan-start">
              Startdatum <span className="text-loss">*</span>
            </Label>
            <Input
              id="edit-loan-start"
              type="date"
              value={form.startDate}
              onChange={(e) => {
                const startDate = e.target.value;
                const months = calcDurationMonths(startDate, form.endDate);
                setForm((p) => ({
                  ...p,
                  startDate,
                  durationMonths: months !== null ? String(months) : p.durationMonths,
                }));
              }}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-loan-amount">
              Uitgeleend bedrag (€) <span className="text-loss">*</span>
            </Label>
            <Input
              id="edit-loan-amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              value={form.loanedAmount}
              onChange={(e) => setForm((p) => ({ ...p, loanedAmount: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-loan-rate">Rentepercentage per jaar (%)</Label>
            <Input
              id="edit-loan-rate"
              type="number"
              step="0.01"
              min="0"
              placeholder="bijv. 5,00"
              value={form.interestRatePercent}
              onChange={(e) => setForm((p) => ({ ...p, interestRatePercent: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-loan-end">Einddatum</Label>
              <Input
                id="edit-loan-end"
                type="date"
                value={form.endDate}
                onChange={(e) => {
                  const endDate = e.target.value;
                  const months = calcDurationMonths(form.startDate, endDate);
                  setForm((p) => ({
                    ...p,
                    endDate,
                    durationMonths: months !== null ? String(months) : p.durationMonths,
                  }));
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-loan-duration">Looptijd (maanden)</Label>
              <Input
                id="edit-loan-duration"
                type="number"
                min="1"
                placeholder="bijv. 24"
                value={form.durationMonths}
                onChange={(e) => setForm((p) => ({ ...p, durationMonths: e.target.value }))}
              />
              {form.durationMonths && !isNaN(parseInt(form.durationMonths)) && (
                <span className="text-xs text-muted-foreground">
                  {formatDuration(parseInt(form.durationMonths))}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-loan-status">Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm((p) => ({ ...p, status: v as LoanStatus }))}
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-loan-notes">Notities</Label>
            <Textarea
              id="edit-loan-notes"
              placeholder="Optionele notitie…"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="resize-none"
            />
          </div>
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <Button type="submit" disabled={updateLoan.isPending}>
              {updateLoan.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Opslaan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Loan Transaction Dialog ──────────────────────────────────────────────

function AddLoanTransactionDialog({
  loan,
  children,
}: {
  loan: LoanView;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    transactionType: LoanTransactionType.interestReceived as LoanTransactionType,
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
    const amount = parseFloat(form.amount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) {
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
          : "Aflossing geregistreerd"
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
                setForm((p) => ({ ...p, transactionType: v as LoanTransactionType }))
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
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="loan-tx-notes">Notitie</Label>
            <Textarea
              id="loan-tx-notes"
              placeholder="Optionele notitie…"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="resize-none"
            />
          </div>
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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

// ─── Loan Card ────────────────────────────────────────────────────────────────

function LoanCard({ loan }: { loan: LoanView }) {
  const [expanded, setExpanded] = useState(false);
  const deleteLoan = useDeleteLoan();
  const deleteLoanTransaction = useDeleteLoanTransaction();
  const updateLoan = useUpdateLoan();

  const outstanding = loanOutstanding(loan);
  const totalInterest = loanTotalInterest(loan);
  const totalRepaid = loanTotalRepaid(loan);
  const returnPct =
    loan.loanedAmount > 0 ? (totalInterest / loan.loanedAmount) * 100 : 0;

  const handleDelete = async () => {
    try {
      await deleteLoan.mutateAsync(loan.id);
      toast.success(`Lening "${loan.name}" verwijderd`);
    } catch {
      toast.error("Fout bij het verwijderen van lening");
    }
  };

  const handleDeleteTx = async (txId: bigint) => {
    try {
      await deleteLoanTransaction.mutateAsync({ loanId: loan.id, txId });
      toast.success("Transactie verwijderd");
    } catch {
      toast.error("Fout bij het verwijderen van transactie");
    }
  };

  const handleStatusChange = async (newStatus: LoanStatus) => {
    try {
      await updateLoan.mutateAsync({
        id: loan.id,
        name: loan.name,
        startDate: loan.startDate,
        loanedAmount: loan.loanedAmount,
        interestRatePercent: loan.interestRatePercent,
        endDate: loan.endDate,
        durationMonths: loan.durationMonths,
        notes: loan.notes,
        status: newStatus,
      });
      toast.success("Status bijgewerkt");
    } catch {
      toast.error("Fout bij het bijwerken van status");
    }
  };

  const sortedTxs = [...loan.transactions].sort((a, b) => Number(b.date - a.date));

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 md:p-5">
        <div className="flex flex-col gap-4">
          {/* Top row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-base">{loan.name}</span>
                {/* Status badge with click to change */}
                <Select
                  value={loan.status}
                  onValueChange={(v) => handleStatusChange(v as LoanStatus)}
                >
                  <SelectTrigger className="h-auto border-0 p-0 focus:ring-0 w-auto shadow-none">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-2 py-0.5 cursor-pointer select-none",
                        statusColor(loan.status)
                      )}
                    >
                      {statusLabel(loan.status)}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={LoanStatus.active}>Actief</SelectItem>
                    <SelectItem value={LoanStatus.repaid}>Afgelost</SelectItem>
                    <SelectItem value={LoanStatus.defaulted}>In gebreke</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">
                  Startdatum: {formatDate(loan.startDate)}
                </span>
                {loan.endDate !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    Einddatum: {formatDate(loan.endDate)}
                  </span>
                )}
                {loan.durationMonths !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    Looptijd: {formatDuration(loan.durationMonths)}
                  </span>
                )}
                {loan.interestRatePercent !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    Rente: {loan.interestRatePercent.toFixed(2).replace(".", ",")}% p.j.
                  </span>
                )}
              </div>
              {loan.notes && (
                <p className="text-xs text-muted-foreground italic">{loan.notes}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <AddLoanTransactionDialog loan={loan}>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Transactie
                </Button>
              </AddLoanTransactionDialog>
              <EditLoanDialog loan={loan}>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  title="Bewerken"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </EditLoanDialog>
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
                    <AlertDialogTitle>Lening verwijderen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Wil je de lening aan <strong>{loan.name}</strong> verwijderen? Alle
                      transacties worden ook verwijderd. Deze actie kan niet ongedaan worden
                      gemaakt.
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
            </div>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCell
              label="Uitgeleend"
              value={
                <span className="num font-medium">{formatEuro(loan.loanedAmount)}</span>
              }
            />
            <MetricCell
              label="Aflossingen"
              value={
                <span className="num font-medium text-muted-foreground">
                  {formatEuro(totalRepaid)}
                </span>
              }
            />
            <MetricCell
              label="Nog uitstaand"
              value={
                <span
                  className={cn(
                    "num font-medium",
                    outstanding > 0 ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {formatEuro(outstanding)}
                </span>
              }
            />
            <MetricCell
              label="Ontvangen rente"
              value={
                <span className={cn("num font-medium", totalInterest > 0 ? "text-gain" : "text-muted-foreground")}>
                  {totalInterest > 0 ? "+" : ""}{formatEuro(totalInterest)}
                </span>
              }
            />
            <MetricCell
              label="Gerealiseerd"
              value={
                <span className={cn("num font-medium", totalInterest > 0 ? "text-gain" : "text-muted-foreground")}>
                  {totalInterest > 0 ? "+" : ""}{formatEuro(totalInterest)}
                </span>
              }
            />
            <MetricCell
              label="Werkelijk rendement"
              value={
                <span className={cn("num font-medium", returnPct > 0 ? "text-gain" : "text-muted-foreground")}>
                  {returnPct > 0 ? "+" : ""}
                  {returnPct.toFixed(2).replace(".", ",")}%
                </span>
              }
            />
          </div>
        </div>
      </div>

      {/* Transaction history (expandable) */}
      {loan.transactions.length > 0 && (
        <div className="px-4 md:px-5 pb-4 border-t border-border/50">
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            <span>{loan.transactions.length} transacties</span>
          </button>

          {expanded && (
            <div className="mt-1 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs uppercase tracking-wider">Datum</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Type</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-right">
                      Bedrag
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Notitie</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTxs.map((tx) => (
                    <TableRow key={String(tx.id)} className="group hover:bg-accent/30">
                      <TableCell className="py-2.5 text-xs text-muted-foreground num">
                        {formatDate(tx.date)}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0",
                            tx.transactionType === LoanTransactionType.interestReceived
                              ? "border-gain/40 text-gain"
                              : "border-primary/40 text-primary"
                          )}
                        >
                          {tx.transactionType === LoanTransactionType.interestReceived
                            ? "Rente ontvangen"
                            : "Aflossing ontvangen"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5 text-right num font-medium">
                        <span
                          className={
                            tx.transactionType === LoanTransactionType.interestReceived
                              ? "text-gain"
                              : ""
                          }
                        >
                          {tx.transactionType === LoanTransactionType.interestReceived
                            ? "+"
                            : ""}
                          {formatEuro(tx.amount)}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-muted-foreground">
                        {tx.notes ?? "—"}
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-loss transition-colors opacity-0 group-hover:opacity-100"
                              title="Verwijderen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Transactie verwijderen?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Deze actie kan niet ongedaan worden gemaakt.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuleren</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteTx(tx.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Verwijderen
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Metric cell ──────────────────────────────────────────────────────────────

function MetricCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
        {label}
      </span>
      <div className="text-sm">{value}</div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function LoansPage() {
  const { data: loans = [], isLoading } = useAllLoans();

  const totalLoaned = loans.reduce((s, l) => s + l.loanedAmount, 0);
  const totalOutstanding = loans.reduce((s, l) => s + loanOutstanding(l), 0);
  const totalInterest = loans.reduce((s, l) => s + loanTotalInterest(l), 0);
  const totalReturnPct = totalLoaned > 0 ? (totalInterest / totalLoaned) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoading
              ? ""
              : loans.length === 0
                ? "Nog geen leningen"
                : `${loans.length} lening${loans.length !== 1 ? "en" : ""}`}
          </p>
        </div>
        <AddLoanDialog>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" />
            Lening toevoegen
          </Button>
        </AddLoanDialog>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Totaal uitgeleend"
          icon={<Wallet className="w-4 h-4" />}
          value={<span className="num">{formatEuro(totalLoaned)}</span>}
        />
        <StatCard
          label="Totaal uitstaand"
          icon={<ArrowDownToLine className="w-4 h-4" />}
          value={<span className="num">{formatEuro(totalOutstanding)}</span>}
        />
        <StatCard
          label="Ontvangen rente"
          icon={<TrendingUp className="w-4 h-4" />}
          value={
            <span className={cn("num", totalInterest > 0 ? "text-gain" : "")}>
              {totalInterest > 0 ? "+" : ""}
              {formatEuro(totalInterest)}
            </span>
          }
        />
        <StatCard
          label="Gerealiseerd rendement"
          icon={<Percent className="w-4 h-4" />}
          value={
            <div className="flex flex-col gap-0.5">
              <span className={cn("num", totalInterest > 0 ? "text-gain" : "")}>
                {totalInterest > 0 ? "+" : ""}
                {formatEuro(totalInterest)}
              </span>
              <span
                className={cn(
                  "text-xs num",
                  totalReturnPct > 0 ? "text-gain" : "text-muted-foreground"
                )}
              >
                {totalReturnPct > 0 ? "+" : ""}
                {totalReturnPct.toFixed(2).replace(".", ",")}%
              </span>
            </div>
          }
        />
      </div>

      {/* Loans list */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {["a", "b"].map((k) => (
            <div key={k} className="bg-card border border-border rounded-lg p-5">
              <Skeleton className="h-5 w-48 mb-3" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      ) : loans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <Inbox className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Geen leningen gevonden</p>
            <p className="text-sm text-muted-foreground mt-1">
              Voeg je eerste lening toe om bij te houden wat je hebt uitgeleend.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {loans.map((loan) => (
            <LoanCard key={String(loan.id)} loan={loan} />
          ))}
        </div>
      )}
    </div>
  );
}
