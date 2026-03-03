import { type AssetView, TransactionType } from "../backend.d";
import { isOngoingCostsType } from "./transactionTypes";

export interface CarryforwardYear {
  year: number;
  /** Bruto gerealiseerde winst (verkopen + dividend + staking) */
  grossRealizedProfit: number;
  /** Transactiekosten (broker fees op koop/verkoop) */
  transactionFees: number;
  /** Werkelijke lopende kosten ETF (ongoingCosts transacties) */
  etfOngoingCosts: number;
  /** Doorgeschoven kosten vanuit vorige jaren */
  carryforwardIn: number;
  /** Totale kosten = transactionFees + etfOngoingCosts + carryforwardIn */
  totalCosts: number;
  /** Netto gerealiseerde winst (kan negatief zijn) */
  netRealizedProfit: number;
  /** Kosten doorgeschoven naar volgend jaar: max(0, totalCosts - grossRealizedProfit) */
  carryforwardOut: number;
  /** Uitsplitsing doorgeschoven-in per bronjaar */
  carryforwardInBreakdown: { fromYear: number; amount: number }[];
}

export interface CarryforwardHistory {
  year: number;
  /** Kosten alleen dit jaar (transactionFees + etfOngoingCosts, geen carryforward-in) */
  costsThisYear: number;
  /** Hoeveel kosten zijn daadwerkelijk verrekend: min(grossRealizedProfit, totalCosts) */
  amountSettled: number;
  /** Cumulatief doorgeschoven uit dit jaar */
  cumulativeCarryforward: number;
}

/**
 * Bereken de gerealiseerde winst voor een asset in een bepaald jaar via FIFO.
 * Telt: verkoopwinst, dividend, staking rewards.
 * Telt NIET: ongoingCosts (dat zijn kosten, geen winst).
 */
function computeGrossRealizedForYear(
  transactions: AssetView["transactions"],
  year: number,
): number {
  const sorted = [...transactions].sort((a, b) => Number(a.date - b.date));

  interface Lot {
    quantity: number;
    costPerUnit: number;
  }
  const lots: Lot[] = [];
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
      if (txYear === year) {
        totalRealized += saleRevenue - costOfSold;
      }
    } else if (tx.transactionType === TransactionType.stakingReward) {
      lots.push({ quantity: tx.quantity, costPerUnit: 0 });
      if (txYear === year && tx.euroValue !== undefined) {
        totalRealized += tx.euroValue;
      }
    } else if (tx.transactionType === TransactionType.dividend) {
      if (txYear === year && tx.euroValue !== undefined) {
        totalRealized += tx.euroValue;
      }
    }
    // ongoingCosts: sla over — zijn kosten, geen winst
  }

  return totalRealized;
}

/**
 * Bereken de carryforward voor alle jaren over alle assets.
 * Geeft een gesorteerde lijst van jaren terug (oudste eerst).
 */
export function computeCarryforwardAllYears(
  assets: AssetView[],
  _ongoingCostsMap: Record<string, boolean>,
): { years: CarryforwardYear[]; history: CarryforwardHistory[] } {
  // Bepaal alle jaren met transacties
  const yearsSet = new Set<number>();
  for (const asset of assets) {
    for (const tx of asset.transactions) {
      const y = new Date(Number(tx.date / 1_000_000n)).getFullYear();
      yearsSet.add(y);
    }
  }

  if (yearsSet.size === 0) {
    return { years: [], history: [] };
  }

  const minYear = Math.min(...yearsSet);
  const currentYear = new Date().getFullYear();

  // Bouw een array van alle jaren van minYear t/m huidig jaar
  const allYears: number[] = [];
  for (let y = minYear; y <= currentYear; y++) {
    allYears.push(y);
  }

  const yearResults: CarryforwardYear[] = [];

  // Bijhouden van openstaande carryforward per bronjar (oldest first)
  // pendingPool: Map<bronYear, openstaand bedrag>
  const pendingPool = new Map<number, number>();

  for (const year of allYears) {
    // Bereken bruto gerealiseerde winst
    let grossRealizedProfit = 0;
    let transactionFees = 0;
    let etfOngoingCosts = 0;

    for (const asset of assets) {
      grossRealizedProfit += computeGrossRealizedForYear(
        asset.transactions,
        year,
      );

      for (const tx of asset.transactions) {
        const txYear = new Date(Number(tx.date / 1_000_000n)).getFullYear();
        if (txYear !== year) continue;

        if (isOngoingCostsType(tx.transactionType)) {
          etfOngoingCosts += tx.euroValue ?? 0;
        } else if (
          tx.transactionType === TransactionType.buy ||
          tx.transactionType === TransactionType.sell
        ) {
          transactionFees += tx.fees ?? 0;
        }
      }
    }

    // Carryforward-in: totaal uit vorige jaren
    const carryforwardIn = Array.from(pendingPool.values()).reduce(
      (s, v) => s + v,
      0,
    );

    // Uitsplitsing carryforward-in per bronjar (alleen bedragen > 0)
    const carryforwardInBreakdown: { fromYear: number; amount: number }[] = [];
    for (const [fromYear, amount] of pendingPool.entries()) {
      if (amount > 0.005) {
        carryforwardInBreakdown.push({ fromYear, amount });
      }
    }
    carryforwardInBreakdown.sort((a, b) => a.fromYear - b.fromYear);

    const totalCosts = transactionFees + etfOngoingCosts + carryforwardIn;
    const netRealizedProfit = grossRealizedProfit - totalCosts;
    const carryforwardOut = Math.max(0, -netRealizedProfit);

    yearResults.push({
      year,
      grossRealizedProfit,
      transactionFees,
      etfOngoingCosts,
      carryforwardIn,
      totalCosts,
      netRealizedProfit,
      carryforwardOut,
      carryforwardInBreakdown,
    });

    // Update pendingPool: verbruik kosten uit het pool op volgorde van oudste naar nieuwste
    // Hoeveel is er beschikbaar om te verrekenen
    let available = grossRealizedProfit;

    // Verbruik eerst de carryforward-in (oudste eerst)
    for (const fromYear of Array.from(pendingPool.keys()).sort(
      (a, b) => a - b,
    )) {
      if (available <= 0) break;
      const pending = pendingPool.get(fromYear) ?? 0;
      const consume = Math.min(available, pending);
      pendingPool.set(fromYear, pending - consume);
      available -= consume;
      if (pendingPool.get(fromYear)! < 0.001) {
        pendingPool.delete(fromYear);
      }
    }

    // Verbruik de kosten van dit jaar zelf
    const costsThisYear = transactionFees + etfOngoingCosts;
    if (costsThisYear > 0) {
      const consumeThisYear = Math.min(available, costsThisYear);
      const remainingThisYear = costsThisYear - consumeThisYear;
      if (remainingThisYear > 0.001) {
        pendingPool.set(year, remainingThisYear);
      }
    }
  }

  // Bouw de geschiedenis tabel
  const history: CarryforwardHistory[] = yearResults.map((yr) => {
    const costsThisYear = yr.transactionFees + yr.etfOngoingCosts;
    const amountSettled = Math.min(yr.grossRealizedProfit, yr.totalCosts);
    return {
      year: yr.year,
      costsThisYear,
      amountSettled,
      cumulativeCarryforward: yr.carryforwardOut,
    };
  });

  // Filter lege jaren eruit voor de geschiedenis (geen kosten en geen carryforward)
  const filteredHistory = history.filter(
    (h) => h.costsThisYear > 0 || h.cumulativeCarryforward > 0,
  );

  return { years: yearResults, history: filteredHistory };
}

/**
 * Geef de carryforward-gegevens voor een specifiek jaar terug.
 * Als het jaar niet bestaat, geef een nul-entry terug.
 */
export function computeCarryforwardForYear(
  assets: AssetView[],
  ongoingCostsMap: Record<string, boolean>,
  year: number,
): CarryforwardYear {
  const { years } = computeCarryforwardAllYears(assets, ongoingCostsMap);
  return (
    years.find((y) => y.year === year) ?? {
      year,
      grossRealizedProfit: 0,
      transactionFees: 0,
      etfOngoingCosts: 0,
      carryforwardIn: 0,
      totalCosts: 0,
      netRealizedProfit: 0,
      carryforwardOut: 0,
      carryforwardInBreakdown: [],
    }
  );
}
