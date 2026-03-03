/**
 * Extended transaction type constant for "Lopende kosten" transactions.
 * The backend.d.ts TransactionType enum does not include ongoingCosts,
 * so we define it as a typed constant here and cast where needed.
 */
import type { TransactionType } from "../backend.d";

export const TX_ONGOING_COSTS = "ongoingCosts" as unknown as TransactionType;

/** Returns true if the transaction type is ongoingCosts */
export function isOngoingCostsType(type: TransactionType): boolean {
  return (type as unknown as string) === "ongoingCosts";
}
