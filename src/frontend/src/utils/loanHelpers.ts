import { LoanStatus, LoanTransactionType, type LoanView } from "../backend.d";

export function calcDurationMonths(
  startDateStr: string,
  endDateStr: string,
): number | null {
  if (!startDateStr || !endDateStr) return null;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  )
    return null;
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );
}

export function formatDuration(months: number | bigint): string {
  const m = typeof months === "bigint" ? Number(months) : months;
  if (m <= 0) return "";
  const years = Math.floor(m / 12);
  const rem = m % 12;
  if (years === 0) return `${m} maand${m !== 1 ? "en" : ""}`;
  if (rem === 0) return `${years} jaar`;
  return `${years} jaar en ${rem} maand${rem !== 1 ? "en" : ""}`;
}

export function loanOutstanding(loan: LoanView): number {
  const totalRepaid = loan.transactions
    .filter((t) => t.transactionType === LoanTransactionType.repaymentReceived)
    .reduce((s, t) => s + t.amount, 0);
  return Math.max(0, loan.loanedAmount - totalRepaid);
}

export function loanTotalInterest(loan: LoanView): number {
  return loan.transactions
    .filter((t) => t.transactionType === LoanTransactionType.interestReceived)
    .reduce((s, t) => s + t.amount, 0);
}

export function loanTotalRepaid(loan: LoanView): number {
  return loan.transactions
    .filter((t) => t.transactionType === LoanTransactionType.repaymentReceived)
    .reduce((s, t) => s + t.amount, 0);
}

export function statusLabel(status: LoanStatus): string {
  switch (status) {
    case LoanStatus.active:
      return "Actief";
    case LoanStatus.repaid:
      return "Afgelost";
    case LoanStatus.defaulted:
      return "In gebreke";
  }
}

export function statusColor(status: LoanStatus): string {
  switch (status) {
    case LoanStatus.active:
      return "border-gain/40 text-gain bg-gain/10";
    case LoanStatus.repaid:
      return "border-primary/40 text-primary bg-primary/10";
    case LoanStatus.defaulted:
      return "border-loss/40 text-loss bg-loss/10";
  }
}
