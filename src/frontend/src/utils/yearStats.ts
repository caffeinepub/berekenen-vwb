import {
  AssetType,
  type AssetView,
  LoanTransactionType,
  type LoanView,
  TransactionType,
} from "../backend.d";
import { calculateFifo } from "./fifo";

export interface YearStats {
  totalInvested: number;
  totalSales: number;
  totalFees: number;
  realizedPnL: number;
  unrealizedPnL: number;
  txTerCosts: number;
  totalDividend: number;
  totalStaking: number;
  totalLoanInterest: number;
  netReturn: number;
  netReturnPct: number;
}

export interface YearTransaction {
  date: bigint;
  assetTicker: string;
  assetName: string;
  assetType: AssetType;
  transactionType: TransactionType;
  quantity: number;
  pricePerUnit: number;
  fees?: number;
  realizedProfit?: number;
  euroValue?: number;
}

export function computeRealizedForYear(
  transactions: {
    date: bigint;
    transactionType: TransactionType;
    quantity: number;
    pricePerUnit: number;
    fees?: number;
    euroValue?: number;
  }[],
  year: number,
): { totalRealized: number; txProfits: Map<number, number> } {
  const sorted = [...transactions]
    .map((tx, origIdx) => ({ ...tx, origIdx }))
    .sort((a, b) => Number(a.date - b.date));

  interface Lot {
    quantity: number;
    costPerUnit: number;
  }
  const lots: Lot[] = [];
  const txProfits = new Map<number, number>();
  let totalRealized = 0;

  for (const tx of sorted) {
    const txYear = new Date(Number(tx.date / 1_000_000n)).getFullYear();
    if (txYear > year) break;

    if (tx.transactionType === TransactionType.buy) {
      const feesPerUnit = (tx.fees ?? 0) / tx.quantity;
      lots.push({
        quantity: tx.quantity,
        costPerUnit: tx.pricePerUnit + feesPerUnit,
      });
    } else if (tx.transactionType === TransactionType.sell) {
      let remaining = tx.quantity;
      const saleRevenue = tx.pricePerUnit * tx.quantity - (tx.fees ?? 0);
      let costOfSold = 0;
      while (remaining > 0 && lots.length > 0) {
        const lot = lots[0];
        if (lot.quantity <= remaining) {
          costOfSold += lot.quantity * lot.costPerUnit;
          remaining -= lot.quantity;
          lots.shift();
        } else {
          costOfSold += remaining * lot.costPerUnit;
          lot.quantity -= remaining;
          remaining = 0;
        }
      }
      const profit = saleRevenue - costOfSold;
      if (txYear === year) {
        totalRealized += profit;
        txProfits.set(tx.origIdx, profit);
      }
    } else if (tx.transactionType === TransactionType.stakingReward) {
      lots.push({ quantity: tx.quantity, costPerUnit: 0 });
      if (txYear === year && tx.euroValue !== undefined) {
        totalRealized += tx.euroValue;
        txProfits.set(tx.origIdx, tx.euroValue);
      }
    } else if (tx.transactionType === TransactionType.dividend) {
      if (txYear === year && tx.euroValue !== undefined) {
        totalRealized += tx.euroValue;
        txProfits.set(tx.origIdx, tx.euroValue);
      }
    }
  }

  return { totalRealized, txProfits };
}

export function computeLoanInterestForYear(
  loans: LoanView[],
  year: number,
): number {
  let total = 0;
  for (const loan of loans) {
    for (const tx of loan.transactions) {
      if (tx.transactionType !== LoanTransactionType.interestReceived) continue;
      const txYear = new Date(Number(tx.date / 1_000_000n)).getFullYear();
      if (txYear === year) {
        total += tx.amount;
      }
    }
  }
  return total;
}

export function computeYearStats(
  assets: AssetView[],
  year: number,
  terMap: Record<string, number>,
  loans: LoanView[] = [],
): YearStats {
  let totalInvested = 0;
  let totalSales = 0;
  let totalFees = 0;
  let realizedPnL = 0;
  let unrealizedPnL = 0;
  let txTerCosts = 0;
  let totalDividend = 0;
  let totalStaking = 0;
  let allTimeInvested = 0;

  for (const asset of assets) {
    const txInYear = asset.transactions.filter((tx) => {
      const txYear = new Date(Number(tx.date / 1_000_000n)).getFullYear();
      return txYear === year;
    });

    for (const tx of txInYear) {
      if (tx.transactionType === TransactionType.buy) {
        totalInvested += tx.quantity * tx.pricePerUnit + (tx.fees ?? 0);
      } else if (tx.transactionType === TransactionType.sell) {
        totalSales += tx.quantity * tx.pricePerUnit - (tx.fees ?? 0);
      } else if (tx.transactionType === TransactionType.dividend) {
        totalDividend += tx.euroValue ?? 0;
      } else if (tx.transactionType === TransactionType.stakingReward) {
        totalStaking += tx.euroValue ?? 0;
      }
      totalFees += tx.fees ?? 0;
    }

    const { totalRealized } = computeRealizedForYear(asset.transactions, year);
    realizedPnL += totalRealized;

    const sorted = [...asset.transactions].sort((a, b) =>
      Number(a.date - b.date),
    );
    interface Lot {
      quantity: number;
      costPerUnit: number;
    }
    const lots: Lot[] = [];
    for (const tx of sorted) {
      if (tx.transactionType === TransactionType.buy) {
        const feesPerUnit = (tx.fees ?? 0) / tx.quantity;
        lots.push({
          quantity: tx.quantity,
          costPerUnit: tx.pricePerUnit + feesPerUnit,
        });
      } else if (tx.transactionType === TransactionType.sell) {
        let remaining = tx.quantity;
        while (remaining > 0 && lots.length > 0) {
          const lot = lots[0];
          if (lot.quantity <= remaining) {
            remaining -= lot.quantity;
            lots.shift();
          } else {
            lot.quantity -= remaining;
            remaining = 0;
          }
        }
      } else if (tx.transactionType === TransactionType.stakingReward) {
        lots.push({ quantity: tx.quantity, costPerUnit: 0 });
      }
    }
    const currentQty = lots.reduce((s, l) => s + l.quantity, 0);
    const costBasis = lots.reduce((s, l) => s + l.quantity * l.costPerUnit, 0);
    unrealizedPnL += currentQty * asset.currentPrice - costBasis;

    for (const tx of asset.transactions) {
      if (tx.transactionType === TransactionType.buy) {
        allTimeInvested += tx.quantity * tx.pricePerUnit + (tx.fees ?? 0);
      }
    }

    if (asset.assetType !== AssetType.crypto) {
      const txTer = terMap[asset.ticker];
      if (txTer !== undefined && txTer > 0) {
        const fifo = calculateFifo(asset.transactions, asset.currentPrice);
        txTerCosts += fifo.currentQuantity * asset.currentPrice * (txTer / 100);
      }
    }
  }

  const totalLoanInterest = computeLoanInterestForYear(loans, year);
  realizedPnL += totalLoanInterest;

  const netReturn = realizedPnL + unrealizedPnL - txTerCosts;
  const netReturnPct =
    allTimeInvested > 0 ? (netReturn / allTimeInvested) * 100 : 0;

  return {
    totalInvested,
    totalSales,
    totalFees,
    realizedPnL,
    unrealizedPnL,
    txTerCosts,
    totalDividend,
    totalStaking,
    totalLoanInterest,
    netReturn,
    netReturnPct,
  };
}

export function getYearTransactions(
  assets: AssetView[],
  year: number,
): YearTransaction[] {
  const result: YearTransaction[] = [];

  for (const asset of assets) {
    const txInYear = asset.transactions.filter((tx) => {
      const txYear = new Date(Number(tx.date / 1_000_000n)).getFullYear();
      return txYear === year;
    });

    const { txProfits } = computeRealizedForYear(asset.transactions, year);

    const sorted = [...asset.transactions].sort((a, b) =>
      Number(a.date - b.date),
    );
    for (const tx of txInYear) {
      const origIdx = sorted.indexOf(tx);
      result.push({
        date: tx.date,
        assetTicker: asset.ticker,
        assetName: asset.name,
        assetType: asset.assetType,
        transactionType: tx.transactionType,
        quantity: tx.quantity,
        pricePerUnit: tx.pricePerUnit,
        fees: tx.fees,
        realizedProfit: txProfits.get(origIdx),
        euroValue: tx.euroValue,
      });
    }
  }

  return result.sort((a, b) => Number(b.date - a.date));
}
