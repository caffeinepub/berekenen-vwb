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
import { cn } from "@/lib/utils";
import { CalendarDays, RepeatIcon, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { LoanTransactionType } from "../../backend.d";
import { formatEuro } from "../../utils/format";
import type { RecurringLoanSchedule } from "./AddLoanTransactionDialog";

const STORAGE_KEY = "portfolioflow_recurring_loans";

function formatISODate(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function frequencyLabel(f: RecurringLoanSchedule["frequency"]): string {
  switch (f) {
    case "daily":
      return "Dagelijks";
    case "weekly":
      return "Wekelijks";
    case "monthly":
      return "Maandelijks";
  }
}

function loadSchedules(): RecurringLoanSchedule[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function RecurringSchedulesOverview() {
  const [schedules, setSchedules] = useState<RecurringLoanSchedule[]>([]);

  useEffect(() => {
    setSchedules(loadSchedules());
  }, []);

  if (schedules.length === 0) return null;

  const handleDelete = (id: string) => {
    const updated = schedules.filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSchedules(updated);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <RepeatIcon className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Actieve herhalingen
        </h3>
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 h-4 rounded-full"
        >
          {schedules.length}
        </Badge>
      </div>

      <div className="flex flex-col gap-2">
        {schedules.map((schedule) => {
          const isInterest =
            schedule.transactionType === LoanTransactionType.interestReceived;

          return (
            <div
              key={schedule.id}
              className="bg-card border border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              {/* Left: core info */}
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">
                    {schedule.loanName}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-1.5 py-0 shrink-0",
                      isInterest
                        ? "border-gain/40 text-gain"
                        : "border-primary/40 text-primary",
                    )}
                  >
                    {isInterest ? "Rente ontvangen" : "Aflossing ontvangen"}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 shrink-0 gap-1"
                  >
                    <RepeatIcon className="w-2.5 h-2.5" />
                    {frequencyLabel(schedule.frequency)}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
                  <span
                    className={cn(
                      "num font-semibold",
                      isInterest ? "text-gain" : "text-foreground",
                    )}
                  >
                    {isInterest ? "+" : ""}
                    {formatEuro(schedule.amount)}
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {formatISODate(schedule.startDate)}
                    {" – "}
                    {formatISODate(schedule.endDate)}
                  </span>
                  <span className="text-muted-foreground/70">
                    Laatste uitvoering:{" "}
                    {schedule.lastExecuted
                      ? formatISODate(schedule.lastExecuted)
                      : "Nog niet uitgevoerd"}
                  </span>
                </div>
              </div>

              {/* Right: delete action */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-loss shrink-0 self-start sm:self-auto"
                    title="Herhaling verwijderen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Herhaling verwijderen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Deze herhaling voor <strong>{schedule.loanName}</strong>{" "}
                      wordt stopgezet. Reeds aangemaakte transacties blijven
                      bewaard.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(schedule.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Verwijderen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          );
        })}
      </div>
    </div>
  );
}
