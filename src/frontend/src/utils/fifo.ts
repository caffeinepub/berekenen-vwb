import { TransactionView, TransactionType } from "../backend.d";

export interface FifoResult {
  realized: number;
  unrealized: number;
  currentQuantity: number;
  costBasis: number; // total cost basis of remaining holdings
  invested: number; // total invested (buy cost + fees)
  netInvested: number; // invested minus the cost-basis of all sold units (original inleg not yet recovered)
}

interface FifoLot {
  quantity: number;
  pricePerUnit: number;
  fees: number;
}

export function calculateFifo(
  transactions: TransactionView[],
  currentPrice: number
): FifoResult {
  // Sort all transactions by date ascending
  const sorted = [...transactions].sort(
    (a, b) => Number(a.date - b.date)
  );

  const lots: FifoLot[] = [];
  let realized = 0;
  let totalInvested = 0;
  let totalCostOfSold = 0;

  for (const tx of sorted) {
    if (tx.transactionType === TransactionType.buy) {
      const fees = tx.fees ?? 0;
      lots.push({
        quantity: tx.quantity,
        pricePerUnit: tx.pricePerUnit,
        fees,
      });
      totalInvested += tx.quantity * tx.pricePerUnit + fees;
    } else if (tx.transactionType === TransactionType.sell) {
      let remaining = tx.quantity;
      const saleRevenue = tx.quantity * tx.pricePerUnit - (tx.fees ?? 0);
      let costOfSold = 0;

      while (remaining > 0 && lots.length > 0) {
        const lot = lots[0];
        if (lot.quantity <= remaining) {
          // Consume entire lot
          const lotCostPerUnit = lot.pricePerUnit + lot.fees / lot.quantity;
          costOfSold += lot.quantity * lotCostPerUnit;
          remaining -= lot.quantity;
          lots.shift();
        } else {
          // Partially consume lot
          const lotCostPerUnit = lot.pricePerUnit + lot.fees / lot.quantity;
          costOfSold += remaining * lotCostPerUnit;
          const fractionRemaining = (lot.quantity - remaining) / lot.quantity;
          lot.fees = lot.fees * fractionRemaining;
          lot.quantity -= remaining;
          remaining = 0;
        }
      }

      totalCostOfSold += costOfSold;
      realized += saleRevenue - costOfSold;
    } else if (tx.transactionType === TransactionType.stakingReward) {
      // Staking rewards: added at cost basis of 0; euroValue at receipt counts as realized profit
      lots.push({
        quantity: tx.quantity,
        pricePerUnit: 0,
        fees: 0,
      });
      realized += tx.euroValue ?? 0;
    } else if (tx.transactionType === TransactionType.dividend) {
      // Dividend: counts as realized profit; no change to lots or totalInvested
      realized += tx.euroValue ?? 0;
    }
  }

  // Calculate remaining quantity and cost basis
  const currentQuantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);
  const costBasis = lots.reduce(
    (sum, lot) => sum + lot.quantity * lot.pricePerUnit + lot.fees,
    0
  );
  const unrealized = currentQuantity * currentPrice - costBasis;

  // netInvested = original inleg minus the cost-basis of all sold units (= inleg not yet recovered)
  const netInvested = Math.max(0, totalInvested - totalCostOfSold);

  return {
    realized,
    unrealized,
    currentQuantity,
    costBasis,
    invested: totalInvested,
    netInvested,
  };
}

export interface PortfolioSummary {
  totalInvested: number;
  totalCurrentValue: number;
  totalRealized: number;
  totalUnrealized: number;
  totalReturn: number;
  totalReturnPct: number;
}

export interface AssetFifoResult extends FifoResult {
  ticker: string;
  currentValue: number;
}
