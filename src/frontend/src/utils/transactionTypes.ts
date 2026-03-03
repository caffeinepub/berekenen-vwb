import { TransactionType } from "../backend.d";

export const TX_ONGOING_COSTS = TransactionType.ongoingCosts;

/** Returns true if the transaction type is ongoingCosts */
export function isOngoingCostsType(type: TransactionType): boolean {
  return type === TransactionType.ongoingCosts;
}
