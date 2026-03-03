import { cn } from "@/lib/utils";
import { AlertCircle, Layers, Receipt, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import {
  AssetType,
  type AssetView,
  LoanTransactionType,
  type LoanView,
} from "../backend.d";
import type { Section } from "../context/AppContext";
import { computeCarryforwardForYear } from "../utils/carryforward";
import { calculateFifo } from "../utils/fifo";
import { formatEuro } from "../utils/format";
import { CategoryCards } from "./dashboard/CategoryCards";
import { PortfolioCharts } from "./dashboard/PortfolioCharts";
import { RecentTransactions } from "./dashboard/RecentTransactions";
import { TotalCard } from "./dashboard/TotalCard";

interface PortfolioDashboardProps {
  assets: AssetView[];
  loans: LoanView[];
  commodityTickers: Set<string>;
  terMap: Record<string, number>;
  ongoingCostsMap: Record<string, boolean>;
  onNavigate: (
    section: Extract<Section, "stocks" | "crypto" | "commodities" | "loans">,
  ) => void;
}

interface KostenverrekeningRowProps {
  label: string;
  amount: number;
  isNegative?: boolean;
  isBold?: boolean;
  isTotal?: boolean;
  isOrange?: boolean;
}

function KostenverrekeningRow({
  label,
  amount,
  isNegative = false,
  isBold = false,
  isTotal = false,
  isOrange = false,
}: KostenverrekeningRowProps) {
  const colorClass = isOrange
    ? "text-amber-500"
    : isTotal
      ? amount > 0.005
        ? "text-gain"
        : amount < -0.005
          ? "text-loss"
          : "text-muted-foreground"
      : isNegative
        ? "text-loss"
        : "text-foreground";

  return (
    <div
      className={cn(
        "flex items-center justify-between py-1.5 text-sm",
        isTotal && "border-t border-border mt-1 pt-2.5",
      )}
    >
      <span
        className={cn(
          "text-muted-foreground",
          isBold && "font-medium text-foreground",
          isTotal && "font-semibold text-foreground",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "num font-medium tabular-nums",
          colorClass,
          isBold && "font-semibold",
          isTotal && "font-bold",
        )}
      >
        {isNegative && amount > 0.005
          ? `-${formatEuro(amount)}`
          : isTotal
            ? amount > 0.005
              ? `+${formatEuro(amount)}`
              : amount < -0.005
                ? `-${formatEuro(Math.abs(amount))}`
                : formatEuro(0)
            : formatEuro(amount)}
      </span>
    </div>
  );
}

interface KostencategoryBlockProps {
  title: string;
  assets: AssetView[];
  ongoingCostsMap: Record<string, boolean>;
  currentYear: number;
  colorAccent: string;
}

function KostencategoryBlock({
  title,
  assets,
  ongoingCostsMap,
  currentYear,
  colorAccent,
}: KostencategoryBlockProps) {
  const cf = useMemo(
    () => computeCarryforwardForYear(assets, ongoingCostsMap, currentYear),
    [assets, ongoingCostsMap, currentYear],
  );

  const hasData =
    cf.grossRealizedProfit > 0.005 ||
    cf.transactionFees > 0.005 ||
    cf.etfOngoingCosts > 0.005 ||
    cf.carryforwardIn > 0.005;

  if (!hasData) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-0.5">
      <div
        className={cn(
          "text-xs font-semibold uppercase tracking-widest mb-2",
          colorAccent,
        )}
      >
        {title}
      </div>
      <KostenverrekeningRow
        label="Gerealiseerde winst (bruto)"
        amount={cf.grossRealizedProfit}
      />
      {cf.transactionFees > 0.005 && (
        <KostenverrekeningRow
          label="Transactiekosten"
          amount={cf.transactionFees}
          isNegative
        />
      )}
      {cf.etfOngoingCosts > 0.005 && (
        <KostenverrekeningRow
          label="Lopende kosten ETF"
          amount={cf.etfOngoingCosts}
          isNegative
        />
      )}
      {cf.carryforwardIn > 0.005 && (
        <KostenverrekeningRow
          label="Doorgeschoven kosten"
          amount={cf.carryforwardIn}
          isNegative
        />
      )}
      <KostenverrekeningRow
        label={`Netto gerealiseerde winst ${currentYear}`}
        amount={cf.netRealizedProfit}
        isTotal
        isBold
      />
      {cf.carryforwardOut > 0.005 && (
        <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span className="text-xs text-muted-foreground">
              Nog niet benutte kosten
            </span>
          </div>
          <span className="num text-sm font-semibold text-amber-500 tabular-nums">
            {formatEuro(cf.carryforwardOut)}
          </span>
        </div>
      )}
      {cf.carryforwardOut <= 0.005 && (
        <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Nog niet benutte kosten
          </span>
          <span className="num text-xs text-muted-foreground tabular-nums">
            {formatEuro(0)}
          </span>
        </div>
      )}
    </div>
  );
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
  ongoingCostsMap,
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

  const currentYear = new Date().getFullYear();

  const hasAnyData = useMemo(
    () => assets.some((a) => a.transactions.length > 0) || loans.length > 0,
    [assets, loans],
  );

  const hasTransactions = useMemo(
    () => assets.some((a) => a.transactions.length > 0),
    [assets],
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

      {hasTransactions && (
        <section aria-label="Kostenverrekening">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-base font-semibold tracking-tight">
              Kostenverrekening {currentYear}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <KostencategoryBlock
              title="Aandelen"
              assets={stockAssets}
              ongoingCostsMap={ongoingCostsMap}
              currentYear={currentYear}
              colorAccent="text-primary"
            />
            <KostencategoryBlock
              title="Crypto"
              assets={cryptoAssets}
              ongoingCostsMap={ongoingCostsMap}
              currentYear={currentYear}
              colorAccent="text-chart-2"
            />
            <KostencategoryBlock
              title="Grondstoffen"
              assets={commodityAssets}
              ongoingCostsMap={ongoingCostsMap}
              currentYear={currentYear}
              colorAccent="text-amber-500"
            />
            {(() => {
              const cf = computeCarryforwardForYear(
                assets,
                ongoingCostsMap,
                currentYear,
              );
              const hasData =
                cf.grossRealizedProfit > 0.005 ||
                cf.transactionFees > 0.005 ||
                cf.etfOngoingCosts > 0.005 ||
                cf.carryforwardIn > 0.005;
              if (!hasData) return null;
              return (
                <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-0.5 sm:col-span-2 xl:col-span-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Portefeuille totaal
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                    <div>
                      <KostenverrekeningRow
                        label="Gerealiseerde winst (bruto)"
                        amount={cf.grossRealizedProfit}
                      />
                      {cf.transactionFees > 0.005 && (
                        <KostenverrekeningRow
                          label="Transactiekosten"
                          amount={cf.transactionFees}
                          isNegative
                        />
                      )}
                      {cf.etfOngoingCosts > 0.005 && (
                        <KostenverrekeningRow
                          label="Lopende kosten ETF"
                          amount={cf.etfOngoingCosts}
                          isNegative
                        />
                      )}
                      {cf.carryforwardIn > 0.005 && (
                        <KostenverrekeningRow
                          label="Doorgeschoven kosten"
                          amount={cf.carryforwardIn}
                          isNegative
                        />
                      )}
                      <KostenverrekeningRow
                        label={`Netto gerealiseerde winst ${currentYear}`}
                        amount={cf.netRealizedProfit}
                        isTotal
                        isBold
                      />
                    </div>
                    <div className="flex flex-col justify-end">
                      {cf.carryforwardOut > 0.005 ? (
                        <div className="flex items-center justify-between py-2 px-3 bg-amber-500/10 border border-amber-500/30 rounded-lg mt-2 sm:mt-0">
                          <div className="flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                              Nog niet benutte kosten
                            </span>
                          </div>
                          <span className="num text-sm font-bold text-amber-500 tabular-nums">
                            {formatEuro(cf.carryforwardOut)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between py-2 px-3 bg-muted/30 border border-border rounded-lg mt-2 sm:mt-0">
                          <span className="text-xs text-muted-foreground">
                            Nog niet benutte kosten
                          </span>
                          <span className="num text-xs text-muted-foreground tabular-nums">
                            {formatEuro(0)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </section>
      )}

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
