/**
 * Format a number as euro currency in Dutch locale
 * e.g., 1234.56 -> "€ 1.234,56"
 */
export function formatEuro(amount: number, decimals = 2): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Format a quantity — up to 8 decimals for crypto, 4 for stocks
 */
export function formatQuantity(qty: number, isCrypto = false): string {
  const maxDecimals = isCrypto ? 8 : 4;
  return new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(qty);
}

/**
 * Format a percentage
 */
export function formatPercent(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2).replace(".", ",")}%`;
}

/**
 * Format a euro amount with sign prefix
 */
export function formatEuroSigned(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  if (amount > 0.005) return `+${formatted}`;
  if (amount < -0.005) return `-${formatted}`;
  return formatted;
}

/**
 * Convert a bigint Time (nanoseconds) to a JS Date
 */
export function timeToDate(time: bigint): Date {
  // nanoseconds -> milliseconds
  return new Date(Number(time / 1_000_000n));
}

/**
 * Format a bigint Time to Dutch date string
 */
export function formatDate(time: bigint): string {
  const date = timeToDate(time);
  return date.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Convert a JS Date to bigint nanoseconds (as used by backend)
 */
export function dateToBigintNano(date: Date): bigint {
  return BigInt(date.getTime()) * 1_000_000n;
}

/**
 * Format a date input string (YYYY-MM-DD) from a date input element
 */
export function dateInputToDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Convert a JS Date to YYYY-MM-DD for date input value
 */
export function dateToInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date as YYYY-MM-DD
 */
export function todayInputValue(): string {
  return dateToInputValue(new Date());
}
