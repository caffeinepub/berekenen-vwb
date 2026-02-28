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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  LoanStatus,
  LoanTransactionType,
  type LoanView,
} from "../../backend.d";
import {
  useDeleteLoan,
  useDeleteLoanTransaction,
  useUpdateLoan,
} from "../../hooks/useQueries";
import { formatDate, formatEuro } from "../../utils/format";
import {
  formatDuration,
  loanOutstanding,
  loanTotalInterest,
  loanTotalRepaid,
  statusColor,
  statusLabel,
} from "../../utils/loanHelpers";
import { AddLoanTransactionDialog } from "./AddLoanTransactionDialog";
import { EditLoanDialog } from "./EditLoanDialog";

function MetricCell({
  label,
  value,
}: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
        {label}
      </span>
      <div className="text-sm">{value}</div>
    </div>
  );
}

export function LoanCard({ loan }: { loan: LoanView }) {
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

  const sortedTxs = [...loan.transactions].sort((a, b) =>
    Number(b.date - a.date),
  );

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 md:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-base">{loan.name}</span>
                <Select
                  value={loan.status}
                  onValueChange={(v) => handleStatusChange(v as LoanStatus)}
                >
                  <SelectTrigger className="h-auto border-0 p-0 focus:ring-0 w-auto shadow-none">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-2 py-0.5 cursor-pointer select-none",
                        statusColor(loan.status),
                      )}
                    >
                      {statusLabel(loan.status)}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={LoanStatus.active}>Actief</SelectItem>
                    <SelectItem value={LoanStatus.repaid}>Afgelost</SelectItem>
                    <SelectItem value={LoanStatus.defaulted}>
                      In gebreke
                    </SelectItem>
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
                    Rente:{" "}
                    {loan.interestRatePercent.toFixed(2).replace(".", ",")}%
                    p.j.
                  </span>
                )}
              </div>
              {loan.notes && (
                <p className="text-xs text-muted-foreground italic">
                  {loan.notes}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <AddLoanTransactionDialog loan={loan}>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5"
                >
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
                      Wil je de lening aan <strong>{loan.name}</strong>{" "}
                      verwijderen? Alle transacties worden ook verwijderd. Deze
                      actie kan niet ongedaan worden gemaakt.
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

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCell
              label="Uitgeleend"
              value={
                <span className="num font-medium">
                  {formatEuro(loan.loanedAmount)}
                </span>
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
                    outstanding > 0
                      ? "text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {formatEuro(outstanding)}
                </span>
              }
            />
            <MetricCell
              label="Ontvangen rente"
              value={
                <span
                  className={cn(
                    "num font-medium",
                    totalInterest > 0 ? "text-gain" : "text-muted-foreground",
                  )}
                >
                  {totalInterest > 0 ? "+" : ""}
                  {formatEuro(totalInterest)}
                </span>
              }
            />
            <MetricCell
              label="Gerealiseerd"
              value={
                <span
                  className={cn(
                    "num font-medium",
                    totalInterest > 0 ? "text-gain" : "text-muted-foreground",
                  )}
                >
                  {totalInterest > 0 ? "+" : ""}
                  {formatEuro(totalInterest)}
                </span>
              }
            />
            <MetricCell
              label="Werkelijk rendement"
              value={
                <span
                  className={cn(
                    "num font-medium",
                    returnPct > 0 ? "text-gain" : "text-muted-foreground",
                  )}
                >
                  {returnPct > 0 ? "+" : ""}
                  {returnPct.toFixed(2).replace(".", ",")}%
                </span>
              }
            />
          </div>
        </div>
      </div>

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
                    <TableHead className="text-xs uppercase tracking-wider">
                      Datum
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">
                      Type
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-right">
                      Bedrag
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">
                      Notitie
                    </TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTxs.map((tx) => (
                    <TableRow
                      key={String(tx.id)}
                      className="group hover:bg-accent/30"
                    >
                      <TableCell className="py-2.5 text-xs text-muted-foreground num">
                        {formatDate(tx.date)}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0",
                            tx.transactionType ===
                              LoanTransactionType.interestReceived
                              ? "border-gain/40 text-gain"
                              : "border-primary/40 text-primary",
                          )}
                        >
                          {tx.transactionType ===
                          LoanTransactionType.interestReceived
                            ? "Rente ontvangen"
                            : "Aflossing ontvangen"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5 text-right num font-medium">
                        <span
                          className={
                            tx.transactionType ===
                            LoanTransactionType.interestReceived
                              ? "text-gain"
                              : ""
                          }
                        >
                          {tx.transactionType ===
                          LoanTransactionType.interestReceived
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
                              <AlertDialogTitle>
                                Transactie verwijderen?
                              </AlertDialogTitle>
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
