import { Layers } from "lucide-react";
import { useMemo } from "react";
import {
  AssetType,
  type AssetView,
  LoanTransactionType,
  type LoanView,
} from "../backend.d";
import type { Section } from "../context/AppContext";
import { calculateFifo } from "../utils/fifo";
import { CategoryCards } from "./dashboard/CategoryCards";
import { PortfolioCharts } from "./dashboard/PortfolioCharts";
import { RecentTransactions } from "./dashboard/RecentTransactions";
import { TotalCard } from "./dashboard/TotalCard";

interface PortfolioDashboardProps {
  assets: AssetView[];
  loans: LoanView[];
  commodityTickers: Set<string>;
  terMap: Record<string, number>;
  onNavigate: (
    section: Extract<Section, "stocks" | "crypto" | "commodities" | "loans">,
  ) => void;
}

type FifoMap = Map<string, ReturnType<typeof calculateFifo>>;

function summarize(assetList: AssetView[], fm: FifoMap) {
  let invested = 0;
  let currentValue = 0;
  let realized = 0;
  let unrealized = 0;
  for (const a of assetList) {
    const f = fm.get(a.ticker);
    if (!f) continue;
    invested += f.netInvested;
    currentValue += f.currentQuantity * a.currentPrice;
    realized += f.realized;
    unrealized += f.unrealized;
  }
  const totalReturn = realized + unrealized;
  const returnPct = invested > 0 ? (totalReturn / invested) * 100 : 0;
  return {
    invested,
    currentValue,
    realized,
    unrealized,
    totalReturn,
    returnPct,
  };
}

export function PortfolioDashboard({
  assets,
  loans,
  commodityTickers,
  onNavigate,
}: PortfolioDashboardProps) {
  const stockAssets = assets.filter(
    (a) => a.assetType === AssetType.stock && !commodityTickers.has(a.ticker),
  );
  const cryptoAssets = assets.filter((a) => a.assetType === AssetType.crypto);
  const commodityAssets = assets.filter(
    (a) => a.assetType === AssetType.stock && commodityTickers.has(a.ticker),
  );

  const fifoMap = useMemo(() => {
    const m = new Map<string, ReturnType<typeof calculateFifo>>();
    for (const asset of assets)
      m.set(
        asset.ticker,
        calculateFifo(asset.transactions, asset.currentPrice),
      );
    return m;
  }, [assets]);

  const stocksSummary = useMemo(
    () => summarize(stockAssets, fifoMap),
    [stockAssets, fifoMap],
  );
  const cryptoSummary = useMemo(
    () => summarize(cryptoAssets, fifoMap),
    [cryptoAssets, fifoMap],
  );
  const commoditiesSummary = useMemo(
    () => summarize(commodityAssets, fifoMap),
    [commodityAssets, fifoMap],
  );

  const loansSummary = useMemo(() => {
    let loanedAmount = 0;
    let totalRepayments = 0;
    let totalInterest = 0;
    for (const loan of loans) {
      loanedAmount += loan.loanedAmount;
      for (const ltx of loan.transactions) {
        if (ltx.transactionType === LoanTransactionType.repaymentReceived)
          totalRepayments += ltx.amount;
        else if (ltx.transactionType === LoanTransactionType.interestReceived)
          totalInterest += ltx.amount;
      }
    }
    return {
      loanedAmount,
      outstanding: loanedAmount - totalRepayments,
      totalInterest,
      returnPct: loanedAmount > 0 ? (totalInterest / loanedAmount) * 100 : 0,
    };
  }, [loans]);

  const portfolioTotals = useMemo(() => {
    const totalInvested =
      stocksSummary.invested +
      cryptoSummary.invested +
      commoditiesSummary.invested +
      loansSummary.loanedAmount;
    const totalCurrentValue =
      stocksSummary.currentValue +
      cryptoSummary.currentValue +
      commoditiesSummary.currentValue +
      loansSummary.outstanding;
    const totalRealized =
      stocksSummary.realized +
      cryptoSummary.realized +
      commoditiesSummary.realized +
      loansSummary.totalInterest;
    const totalUnrealized =
      stocksSummary.unrealized +
      cryptoSummary.unrealized +
      commoditiesSummary.unrealized;
    const totalReturn = totalRealized + totalUnrealized;
    return {
      totalInvested,
      totalCurrentValue,
      totalRealized,
      totalUnrealized,
      totalReturn,
      totalReturnPct:
        totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0,
    };
  }, [stocksSummary, cryptoSummary, commoditiesSummary, loansSummary]);

  const hasAnyData = useMemo(
    () => assets.some((a) => a.transactions.length > 0) || loans.length > 0,
    [assets, loans],
  );

  if (!hasAnyData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
          <Layers className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground mb-1">
            PortfolioFlow
          </h2>
          <p className="text-muted-foreground text-sm max-w-sm font-medium">
            Grip op je beleggingen. Inzicht in je winst. Alles overzichtelijk in
            één app.
          </p>
          <p className="text-muted-foreground text-sm max-w-sm mt-2">
            Voeg je eerste transactie toe om je overzicht te zien.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-center text-sm text-muted-foreground">
          {(
            [
              ["stocks", "Aandelen"],
              ["crypto", "Crypto"],
              ["commodities", "Grondstoffen"],
              ["loans", "Leningen"],
            ] as const
          ).map(([sec, label]) => (
            <button
              key={sec}
              type="button"
              onClick={() => onNavigate(sec)}
              className="px-3 py-1.5 rounded-lg border border-border hover:border-primary/30 hover:text-foreground transition-colors"
            >
              {label} toevoegen →
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="text-center pb-2">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          PortfolioFlow
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Grip op je beleggingen. Inzicht in je winst. Alles overzichtelijk in
          één app.
        </p>
      </div>

      <TotalCard totals={portfolioTotals} />

      <CategoryCards
        stocks={{
          invested: stocksSummary.invested,
          currentValue: stocksSummary.currentValue,
          returnEuro: stocksSummary.totalReturn,
          returnPct: stocksSummary.returnPct,
        }}
        crypto={{
          invested: cryptoSummary.invested,
          currentValue: cryptoSummary.currentValue,
          returnEuro: cryptoSummary.totalReturn,
          returnPct: cryptoSummary.returnPct,
        }}
        commodities={{
          invested: commoditiesSummary.invested,
          currentValue: commoditiesSummary.currentValue,
          returnEuro: commoditiesSummary.totalReturn,
          returnPct: commoditiesSummary.returnPct,
        }}
        loans={loansSummary}
        onNavigate={onNavigate}
      />

      <PortfolioCharts
        assets={assets}
        loans={loans}
        commodityTickers={commodityTickers}
      />

      <RecentTransactions
        assets={assets}
        loans={loans}
        commodityTickers={commodityTickers}
        onNavigate={onNavigate}
      />
    </div>
  );
}
