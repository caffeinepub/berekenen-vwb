import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { LoanTransactionType, LoanView } from "../backend.d";
import type { RecurringLoanSchedule } from "../components/loans/AddLoanTransactionDialog";
import {
  dateInputToDate,
  dateToBigintNano,
  dateToInputValue,
} from "../utils/format";
import { useAddLoanTransaction } from "./useQueries";

const STORAGE_KEY = "portfolioflow_recurring_loans";

function getNextDate(
  from: Date,
  frequency: "daily" | "weekly" | "monthly",
): Date {
  const next = new Date(from);
  if (frequency === "daily") {
    next.setDate(next.getDate() + 1);
  } else if (frequency === "weekly") {
    next.setDate(next.getDate() + 7);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

/**
 * Runs on the Loans page — checks localStorage for recurring schedules and
 * creates any transactions that are due (from lastExecuted/startDate up to today).
 */
export function useRecurringLoanTransactions(loans: LoanView[]) {
  const addLoanTransaction = useAddLoanTransaction();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current || loans.length === 0) return;
    hasRun.current = true;

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    let schedules: RecurringLoanSchedule[] = [];
    try {
      schedules = JSON.parse(raw);
    } catch {
      return;
    }

    if (schedules.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let anyCreated = 0;
    const updatedSchedules: RecurringLoanSchedule[] = [];

    for (const schedule of schedules) {
      const loan = loans.find((l) => l.id.toString() === schedule.loanId);
      if (!loan) {
        // Loan deleted — remove schedule
        continue;
      }

      const endDate = dateInputToDate(schedule.endDate);
      endDate.setHours(0, 0, 0, 0);

      // If schedule has expired, keep it but don't process
      if (endDate < today) {
        updatedSchedules.push(schedule);
        continue;
      }

      // Determine the next date to execute from
      let cursor = dateInputToDate(schedule.lastExecuted ?? schedule.startDate);
      cursor.setHours(0, 0, 0, 0);

      // If we've already executed today (or lastExecuted == today), skip
      const lastExecStr = schedule.lastExecuted;
      if (lastExecStr) {
        const lastExec = dateInputToDate(lastExecStr);
        lastExec.setHours(0, 0, 0, 0);
        // Advance cursor past last executed date
        cursor = getNextDate(lastExec, schedule.frequency);
      }

      let lastExecuted = schedule.lastExecuted;

      // Execute all due dates up to today
      while (cursor <= today && cursor <= endDate) {
        const dateNano = dateToBigintNano(cursor);
        addLoanTransaction
          .mutateAsync({
            loanId: loan.id,
            transactionType: schedule.transactionType as LoanTransactionType,
            date: dateNano,
            amount: schedule.amount,
            notes: schedule.notes,
          })
          .catch(() => {
            // silently ignore individual failures
          });

        lastExecuted = dateToInputValue(cursor);
        anyCreated++;
        cursor = getNextDate(cursor, schedule.frequency);
      }

      updatedSchedules.push({ ...schedule, lastExecuted });
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSchedules));

    if (anyCreated > 0) {
      toast.success(
        `${anyCreated} herhaalde transactie${anyCreated !== 1 ? "s" : ""} automatisch aangemaakt`,
      );
    }
  }, [loans, addLoanTransaction]);
}
