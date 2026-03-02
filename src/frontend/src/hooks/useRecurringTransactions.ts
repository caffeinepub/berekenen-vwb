import { useEffect, useRef } from "react";
import { TransactionType } from "../backend.d";
import type { RecurringAssetSchedule } from "../components/AddTransactionDialog";
import type { RecurringLoanSchedule } from "../components/loans/AddLoanTransactionDialog";
import {
  dateInputToDate,
  dateToBigintNano,
  dateToInputValue,
} from "../utils/format";
import { useAddLoanTransaction, useAddTransaction } from "./useQueries";

/**
 * Generate all pending dates for a recurring schedule up to today.
 */
function getNextDates(
  schedule: {
    startDate: string;
    endDate: string;
    frequency: "daily" | "weekly" | "monthly";
    lastExecuted?: string;
  },
  today: Date,
): Date[] {
  const endDate = dateInputToDate(schedule.endDate);
  const startDate = dateInputToDate(schedule.startDate);

  // Start from the day after lastExecuted, or from startDate
  let cursor: Date;
  if (schedule.lastExecuted) {
    cursor = dateInputToDate(schedule.lastExecuted);
    // Advance by one period from lastExecuted
    cursor = advanceByPeriod(cursor, schedule.frequency);
  } else {
    cursor = new Date(startDate);
  }

  const cutoff = today < endDate ? today : endDate;
  const dates: Date[] = [];

  while (cursor <= cutoff) {
    dates.push(new Date(cursor));
    cursor = advanceByPeriod(cursor, schedule.frequency);
  }

  return dates;
}

function advanceByPeriod(
  date: Date,
  frequency: "daily" | "weekly" | "monthly",
): Date {
  const d = new Date(date);
  if (frequency === "daily") {
    d.setDate(d.getDate() + 1);
  } else if (frequency === "weekly") {
    d.setDate(d.getDate() + 7);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

/**
 * Hook that auto-executes pending recurring transactions on mount.
 * Reads schedules from localStorage and submits any missed transactions.
 */
export function useRecurringTransactions() {
  const hasRun = useRef(false);
  const addTransaction = useAddTransaction();
  const addLoanTransaction = useAddLoanTransaction();
  // Use refs so the effect doesn't need to re-run when mutations change identity
  const addTransactionRef = useRef(addTransaction.mutateAsync);
  const addLoanTransactionRef = useRef(addLoanTransaction.mutateAsync);
  addTransactionRef.current = addTransaction.mutateAsync;
  addLoanTransactionRef.current = addLoanTransaction.mutateAsync;

  useEffect(() => {
    // Prevent running twice in StrictMode
    if (hasRun.current) return;
    hasRun.current = true;

    const today = new Date();
    today.setHours(23, 59, 59, 999); // end of today

    // Process asset recurring schedules
    const assetKey = "portfolioflow_recurring_assets";
    const assetSchedules: RecurringAssetSchedule[] = JSON.parse(
      localStorage.getItem(assetKey) ?? "[]",
    );

    const processAssetSchedules = async () => {
      const updated = [...assetSchedules];

      for (let i = 0; i < updated.length; i++) {
        const schedule = updated[i];

        // Skip expired schedules
        const endDate = dateInputToDate(schedule.endDate);
        if (
          today > endDate &&
          (schedule.lastExecuted === schedule.endDate ||
            endDate < new Date(schedule.startDate))
        ) {
          continue;
        }

        const pendingDates = getNextDates(schedule, today);
        if (pendingDates.length === 0) continue;

        let lastExecuted: string | undefined = schedule.lastExecuted;

        for (const date of pendingDates) {
          try {
            const dateBigint = dateToBigintNano(date);
            await addTransactionRef.current({
              asset: schedule.ticker,
              transactionType: schedule.transactionType,
              date: dateBigint,
              quantity: schedule.quantity,
              pricePerUnit: schedule.pricePerUnit,
              fees: schedule.fees,
              euroValue:
                schedule.transactionType === TransactionType.stakingReward
                  ? schedule.stakingEuroValue
                  : schedule.euroValue,
              notes: schedule.notes,
            });
            lastExecuted = dateToInputValue(date);
          } catch {
            // If one fails, stop processing this schedule
            break;
          }
        }

        if (lastExecuted !== schedule.lastExecuted) {
          updated[i] = { ...schedule, lastExecuted };
        }
      }

      // Save updated schedules back to localStorage
      localStorage.setItem(assetKey, JSON.stringify(updated));
    };

    // Process loan recurring schedules
    const loanKey = "portfolioflow_recurring_loans";
    const loanSchedules: RecurringLoanSchedule[] = JSON.parse(
      localStorage.getItem(loanKey) ?? "[]",
    );

    const processLoanSchedules = async () => {
      const updated = [...loanSchedules];

      for (let i = 0; i < updated.length; i++) {
        const schedule = updated[i];

        // Skip expired schedules
        const endDate = dateInputToDate(schedule.endDate);
        if (
          today > endDate &&
          (schedule.lastExecuted === schedule.endDate ||
            endDate < new Date(schedule.startDate))
        ) {
          continue;
        }

        const pendingDates = getNextDates(schedule, today);
        if (pendingDates.length === 0) continue;

        let lastExecuted: string | undefined = schedule.lastExecuted;

        for (const date of pendingDates) {
          try {
            const dateBigint = dateToBigintNano(date);
            await addLoanTransactionRef.current({
              loanId: BigInt(schedule.loanId),
              transactionType: schedule.transactionType,
              date: dateBigint,
              amount: schedule.amount,
              notes: schedule.notes,
            });
            lastExecuted = dateToInputValue(date);
          } catch {
            // If one fails, stop processing this schedule
            break;
          }
        }

        if (lastExecuted !== schedule.lastExecuted) {
          updated[i] = { ...schedule, lastExecuted };
        }
      }

      // Save updated schedules back to localStorage
      localStorage.setItem(loanKey, JSON.stringify(updated));
    };

    void processAssetSchedules();
    void processLoanSchedules();
  }, []); // Run once on mount
}
