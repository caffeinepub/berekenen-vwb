import { useMemo, useCallback, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  LabelList,
} from "recharts";
import {
  AssetView,
  LoanView,
  LoanTransactionType,
  TransactionType,
  AssetType,
} from "../backend.d";
import { calculateFifo } from "../utils/fifo";
import { formatEuro, formatEuroSigned, formatPercent, formatDate, timeToDate } from "../utils/format";
import { MoneyValue, ReturnValue } from "./MoneyValue";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  BarChart3,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Coins,
  Mountain,
  Handshake,
  Layers,
  Clock,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PortfolioDashboardProps {
  assets: AssetView[];
  loans: LoanView[];
  commodityTickers: Set<string>;
  terMap: Record<string, number>;
  onNavigate: (section: "stocks" | "crypto" | "commodities" | "loans") => void;
}

type TimeFilter = "3M" | "6M" | "1Y" | "ALL";

// ─── Colour palette (matches chart tokens) ──────────────────────────────────
const CHART_COLORS = {
  stocks: "oklch(0.6 0.18 220)",
  crypto: "oklch(0.62 0.17 145)",
  commodities: "oklch(0.65 0.2 55)",
  loans: "oklch(0.58 0.22 280)",
};

const CHART_COLORS_ARR = [
  CHART_COLORS.stocks,
  CHART_COLORS.crypto,
  CHART_COLORS.commodities,
  CHART_COLORS.loans,
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getYear(time: bigint) {
  return timeToDate(time).getFullYear();
}

function getMonthLabel(date: Date) {
  return date.toLocaleDateString("nl-NL", { month: "short", year: "2-digit" });
}

// ─── Transaction label helpers ───────────────────────────────────────────────
function txTypeLabel(type: TransactionType | LoanTransactionType): string {
  switch (type) {
    case TransactionType.buy:
      return "Aankoop";
    case TransactionType.sell:
      return "Verkoop";
    case TransactionType.dividend:
      return "Dividend";
    case TransactionType.stakingReward:
      return "Staking";
    case LoanTransactionType.interestReceived:
      return "Rente";
    case LoanTransactionType.repaymentReceived:
      return "Aflossing";
    default:
      return String(type);
  }
}

// ─── Category card ────────────────────────────────────────────────────────────
interface CategoryCardProps {
  title: string;
  icon: React.ReactNode;
  iconColor: string;
  invested: string;
  currentValue: string;
  returnEuro: number;
  returnPct: number;
  onClick: () => void;
  delay?: number;
  investedLabel?: string;
  currentValueLabel?: string;
}

function CategoryCard({
  title,
  icon,
  iconColor,
  invested,
  currentValue,
  returnEuro,
  returnPct,
  onClick,
  delay = 0,
  investedLabel = "Geïnvesteerd",
  currentValueLabel = "Actuele waarde",
}: CategoryCardProps) {
  const isPositive = returnEuro > 0.005;
  const isNegative = returnEuro < -0.005;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group bg-card border border-border rounded-xl p-5 flex flex-col gap-4",
        "text-left cursor-pointer transition-all duration-200",
        "hover:shadow-card-hover hover:border-primary/30",
        "opacity-0 animate-fade-in-up"
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center", iconColor)}>
            {icon}
          </span>
          <span className="font-semibold text-sm">{title}</span>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">{investedLabel}</div>
          <div className="text-sm font-medium num">{invested}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">{currentValueLabel}</div>
          <div className="text-sm font-medium num">{currentValue}</div>
        </div>
      </div>

      {/* Return */}
      <div
        className={cn(
          "flex items-center justify-between rounded-lg px-3 py-2",
          isPositive ? "bg-gain-muted" : isNegative ? "bg-loss-muted" : "bg-muted/50"
        )}
      >
        <span className="text-xs text-muted-foreground">Rendement</span>
        <div className="flex items-center gap-2">
          {isPositive ? (
            <ArrowUpRight className="w-3.5 h-3.5 text-gain" />
          ) : isNegative ? (
            <ArrowDownRight className="w-3.5 h-3.5 text-loss" />
          ) : (
            <Minus className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span
            className={cn(
              "text-sm font-semibold num",
              isPositive ? "text-gain" : isNegative ? "text-loss" : "text-muted-foreground"
            )}
          >
            {formatEuroSigned(returnEuro)}
          </span>
          <span
            className={cn(
              "text-xs num",
              isPositive ? "text-gain" : isNegative ? "text-loss" : "text-muted-foreground"
            )}
          >
            {formatPercent(returnPct)}
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Custom tooltip ─────────────────────────────────────────────────────────
function CustomLineTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <div className="font-medium text-foreground mb-1">{label}</div>
      <div className="text-muted-foreground">
        Waarde: <span className="text-foreground font-semibold num">{formatEuro(payload[0].value)}</span>
      </div>
    </div>
  );
}

function CustomBarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; fill: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <div className="font-medium text-foreground mb-2">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold num">{formatEuro(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Recent transaction row ──────────────────────────────────────────────────
interface RecentTx {
  date: bigint;
  category: string;
  name: string;
  type: TransactionType | LoanTransactionType;
  amount: number;
  section: "stocks" | "crypto" | "commodities" | "loans";
}

// ─── Main component ──────────────────────────────────────────────────────────

export function PortfolioDashboard({
  assets,
  loans,
  commodityTickers,
  onNavigate,
}: PortfolioDashboardProps) {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("ALL");

  // ── Split assets by category ──────────────────────────────────────────────
  const stockAssets = assets.filter(
    (a) => a.assetType === AssetType.stock && !commodityTickers.has(a.ticker)
  );
  const cryptoAssets = assets.filter((a) => a.assetType === AssetType.crypto);
  const commodityAssets = assets.filter(
    (a) => a.assetType === AssetType.stock && commodityTickers.has(a.ticker)
  );

  // ── FIFO per asset ─────────────────────────────────────────────────────────
  const fifoMap = useMemo(() => {
    const m = new Map<string, ReturnType<typeof calculateFifo>>();
    for (const asset of assets) {
      m.set(asset.ticker, calculateFifo(asset.transactions, asset.currentPrice));
    }
    return m;
  }, [assets]);

  // ── Category totals ────────────────────────────────────────────────────────
  const categorySummary = useCallback(
    (assetList: AssetView[]) => {
      let invested = 0;
      let currentValue = 0;
      let realized = 0;
      let unrealized = 0;
      for (const a of assetList) {
        const f = fifoMap.get(a.ticker);
        if (!f) continue;
        invested += f.netInvested;
        currentValue += f.currentQuantity * a.currentPrice;
        realized += f.realized;
        unrealized += f.unrealized;
      }
      const totalReturn = realized + unrealized;
      const returnPct = invested > 0 ? (totalReturn / invested) * 100 : 0;
      return { invested, currentValue, realized, unrealized, totalReturn, returnPct };
    },
    [fifoMap]
  );

  const stocksSummary = useMemo(() => categorySummary(stockAssets), [stockAssets, categorySummary]);
  const cryptoSummary = useMemo(() => categorySummary(cryptoAssets), [cryptoAssets, categorySummary]);
  const commoditiesSummary = useMemo(
    () => categorySummary(commodityAssets),
    [commodityAssets, categorySummary]
  );

  // ── Loans totals ──────────────────────────────────────────────────────────
  const loansSummary = useMemo(() => {
    let loanedAmount = 0;
    let totalRepayments = 0;
    let totalInterest = 0;
    for (const loan of loans) {
      loanedAmount += loan.loanedAmount;
      for (const ltx of loan.transactions) {
        if (ltx.transactionType === LoanTransactionType.repaymentReceived) {
          totalRepayments += ltx.amount;
        } else if (ltx.transactionType === LoanTransactionType.interestReceived) {
          totalInterest += ltx.amount;
        }
      }
    }
    const outstanding = loanedAmount - totalRepayments;
    const returnPct = loanedAmount > 0 ? (totalInterest / loanedAmount) * 100 : 0;
    return { loanedAmount, totalRepayments, outstanding, totalInterest, returnPct };
  }, [loans]);

  // ── Portfolio totals ──────────────────────────────────────────────────────
  const portfolioTotal = useMemo(() => {
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
      stocksSummary.unrealized + cryptoSummary.unrealized + commoditiesSummary.unrealized;

    const totalReturn = totalRealized + totalUnrealized;
    const totalReturnPct = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

    return {
      totalInvested,
      totalCurrentValue,
      totalRealized,
      totalUnrealized,
      totalReturn,
      totalReturnPct,
    };
  }, [stocksSummary, cryptoSummary, commoditiesSummary, loansSummary]);

  // ── Check for any transactions ─────────────────────────────────────────────
  const hasAnyData = useMemo(() => {
    const hasAssetTx = assets.some((a) => a.transactions.length > 0);
    const hasLoanTx = loans.some((l) => l.transactions.length > 0 || l.loanedAmount > 0);
    return hasAssetTx || hasLoanTx || loans.length > 0;
  }, [assets, loans]);

  // ── Grafiek 1: Portefeuillewaarde over tijd ────────────────────────────────
  const lineChartData = useMemo(() => {
    // Collect all transaction dates
    const allDates: Date[] = [];
    for (const asset of assets) {
      for (const tx of asset.transactions) {
        allDates.push(timeToDate(tx.date));
      }
    }
    for (const loan of loans) {
      allDates.push(timeToDate(loan.startDate));
      for (const ltx of loan.transactions) {
        allDates.push(timeToDate(ltx.date));
      }
    }
    if (allDates.length === 0) return [];

    const earliest = allDates.reduce((a, b) => (a < b ? a : b));
    const now = new Date();

    // Generate monthly intervals
    const months: Date[] = [];
    const cur = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    while (cur <= end) {
      months.push(new Date(cur));
      cur.setMonth(cur.getMonth() + 1);
    }

    // For each month-end point, approximate portfolio value using current prices
    // (simplified: quantity held as of that month × current price)
    return months.map((monthStart) => {
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
      const monthEndMs = monthEnd.getTime();

      let totalValue = 0;
      for (const asset of assets) {
        // Count holdings as of end of month
        let qty = 0;
        for (const tx of asset.transactions) {
          const txMs = Number(tx.date / 1_000_000n);
          if (txMs <= monthEndMs) {
            if (tx.transactionType === TransactionType.buy) {
              qty += tx.quantity;
            } else if (tx.transactionType === TransactionType.sell) {
              qty -= tx.quantity;
            } else if (tx.transactionType === TransactionType.stakingReward) {
              qty += tx.quantity;
            }
          }
        }
        totalValue += Math.max(0, qty) * asset.currentPrice;
      }
      // Add outstanding loans
      for (const loan of loans) {
        const loanStartMs = Number(loan.startDate / 1_000_000n);
        if (loanStartMs <= monthEndMs) {
          let repaid = 0;
          for (const ltx of loan.transactions) {
            const ltxMs = Number(ltx.date / 1_000_000n);
            if (
              ltxMs <= monthEndMs &&
              ltx.transactionType === LoanTransactionType.repaymentReceived
            ) {
              repaid += ltx.amount;
            }
          }
          totalValue += Math.max(0, loan.loanedAmount - repaid);
        }
      }

      return {
        label: getMonthLabel(monthStart),
        value: totalValue,
      };
    });
  }, [assets, loans]);

  const filteredLineData = useMemo(() => {
    if (timeFilter === "ALL" || lineChartData.length === 0) return lineChartData;
    const months = timeFilter === "3M" ? 3 : timeFilter === "6M" ? 6 : 12;
    return lineChartData.slice(Math.max(0, lineChartData.length - months));
  }, [lineChartData, timeFilter]);

  // ── Grafiek 2: Verdeling portefeuille (donut) ──────────────────────────────
  const donutData = useMemo(() => {
    const data = [
      { name: "Aandelen", value: stocksSummary.currentValue },
      { name: "Crypto", value: cryptoSummary.currentValue },
      { name: "Grondstoffen", value: commoditiesSummary.currentValue },
      { name: "Leningen", value: loansSummary.outstanding },
    ].filter((d) => d.value > 0);
    const total = data.reduce((s, d) => s + d.value, 0);
    return data.map((d) => ({ ...d, pct: total > 0 ? (d.value / total) * 100 : 0 }));
  }, [stocksSummary, cryptoSummary, commoditiesSummary, loansSummary]);

  // ── Grafiek 3: Gerealiseerd rendement per categorie per jaar ──────────────
  const barChartData = useMemo(() => {
    const yearsSet = new Set<number>();
    for (const asset of assets) {
      for (const tx of asset.transactions) yearsSet.add(getYear(tx.date));
    }
    for (const loan of loans) {
      for (const ltx of loan.transactions) yearsSet.add(getYear(ltx.date));
    }
    if (yearsSet.size === 0) return [];
    const years = Array.from(yearsSet).sort();

    return years.map((year) => {
      // Calculate realized per category for this year via sell transactions + income
      function realizedForAssets(assetList: AssetView[]) {
        let total = 0;
        for (const asset of assetList) {
          // Sum up sell revenues, dividend, staking in that year
          for (const tx of asset.transactions) {
            if (getYear(tx.date) !== year) continue;
            if (tx.transactionType === TransactionType.sell) {
              // Simplified: revenue - proportional cost (use full FIFO but filter)
              total += tx.quantity * tx.pricePerUnit - (tx.fees ?? 0);
            } else if (
              tx.transactionType === TransactionType.dividend ||
              tx.transactionType === TransactionType.stakingReward
            ) {
              total += tx.euroValue ?? 0;
            }
          }
          // Subtract buy costs for that year's sells (simplified: just use net from FIFO over all)
          // For the chart, show simple realized (sell revenue - buy cost approximation)
        }
        return total;
      }

      const stocksRealized = (() => {
        let total = 0;
        for (const asset of stockAssets) {
          for (const tx of asset.transactions) {
            if (getYear(tx.date) !== year) continue;
            if (tx.transactionType === TransactionType.sell) {
              total += tx.quantity * tx.pricePerUnit - (tx.fees ?? 0);
            } else if (tx.transactionType === TransactionType.dividend) {
              total += tx.euroValue ?? 0;
            }
          }
        }
        return total;
      })();

      const cryptoRealized = (() => {
        let total = 0;
        for (const asset of cryptoAssets) {
          for (const tx of asset.transactions) {
            if (getYear(tx.date) !== year) continue;
            if (tx.transactionType === TransactionType.sell) {
              total += tx.quantity * tx.pricePerUnit - (tx.fees ?? 0);
            } else if (tx.transactionType === TransactionType.stakingReward) {
              total += tx.euroValue ?? 0;
            }
          }
        }
        return total;
      })();

      const commoditiesRealized = realizedForAssets(commodityAssets);

      const loansRealized = loans.reduce((sum, loan) => {
        return (
          sum +
          loan.transactions
            .filter(
              (ltx) =>
                getYear(ltx.date) === year &&
                ltx.transactionType === LoanTransactionType.interestReceived
            )
            .reduce((s, ltx) => s + ltx.amount, 0)
        );
      }, 0);

      return {
        year: String(year),
        Aandelen: stocksRealized,
        Crypto: cryptoRealized,
        Grondstoffen: commoditiesRealized,
        Leningen: loansRealized,
      };
    });
  }, [assets, loans, stockAssets, cryptoAssets, commodityAssets]);

  // ── Grafiek 4: Rendement vergelijking (%) ─────────────────────────────────
  const comparisonData = useMemo(() => {
    return [
      { name: "Aandelen", value: stocksSummary.returnPct, color: CHART_COLORS.stocks },
      { name: "Crypto", value: cryptoSummary.returnPct, color: CHART_COLORS.crypto },
      {
        name: "Grondstoffen",
        value: commoditiesSummary.returnPct,
        color: CHART_COLORS.commodities,
      },
      { name: "Leningen", value: loansSummary.returnPct, color: CHART_COLORS.loans },
    ].filter(
      (d) =>
        d.value !== 0 ||
        (d.name === "Aandelen" && stocksSummary.invested > 0) ||
        (d.name === "Crypto" && cryptoSummary.invested > 0) ||
        (d.name === "Grondstoffen" && commoditiesSummary.invested > 0) ||
        (d.name === "Leningen" && loansSummary.loanedAmount > 0)
    );
  }, [stocksSummary, cryptoSummary, commoditiesSummary, loansSummary]);

  // ── Recente transacties ────────────────────────────────────────────────────
  const recentTransactions = useMemo((): RecentTx[] => {
    const txs: RecentTx[] = [];

    for (const asset of assets) {
      const section: "stocks" | "crypto" | "commodities" =
        asset.assetType === AssetType.crypto
          ? "crypto"
          : commodityTickers.has(asset.ticker)
            ? "commodities"
            : "stocks";
      const category = section === "stocks" ? "Aandelen" : section === "crypto" ? "Crypto" : "Grondstoffen";

      for (const tx of asset.transactions) {
        const amount =
          tx.transactionType === TransactionType.dividend ||
          tx.transactionType === TransactionType.stakingReward
            ? (tx.euroValue ?? 0)
            : tx.quantity * tx.pricePerUnit;
        txs.push({
          date: tx.date,
          category,
          name: asset.name,
          type: tx.transactionType,
          amount,
          section,
        });
      }
    }

    for (const loan of loans) {
      for (const ltx of loan.transactions) {
        txs.push({
          date: ltx.date,
          category: "Leningen",
          name: loan.name,
          type: ltx.transactionType,
          amount: ltx.amount,
          section: "loans",
        });
      }
    }

    return txs.sort((a, b) => Number(b.date - a.date)).slice(0, 8);
  }, [assets, loans, commodityTickers]);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!hasAnyData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
          <Layers className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            Welkom bij Berekenen VWB
          </h2>
          <p className="text-muted-foreground text-sm max-w-sm">
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

  const returnIsPositive = portfolioTotal.totalReturn > 0.005;
  const returnIsNegative = portfolioTotal.totalReturn < -0.005;

  return (
    <div className="flex flex-col gap-8">
      {/* ── Totaalkaart ──────────────────────────────────────────────────── */}
      <section aria-label="Totaaloverzicht portefeuille">
        <div
          className={cn(
            "rounded-2xl border p-6 bg-card",
            returnIsPositive ? "border-gain/30" : returnIsNegative ? "border-loss/30" : "border-border"
          )}
        >
          <div className="flex items-center gap-2 mb-5">
            {returnIsPositive ? (
              <TrendingUp className="w-5 h-5 text-gain" />
            ) : returnIsNegative ? (
              <TrendingDown className="w-5 h-5 text-loss" />
            ) : (
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
            )}
            <h2 className="font-semibold text-base">Totaaloverzicht</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Totaal geïnvesteerd */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-widest">
                <Wallet className="w-3.5 h-3.5" /> Inleg
              </div>
              <div className="text-lg font-semibold num">
                {formatEuro(portfolioTotal.totalInvested)}
              </div>
            </div>

            {/* Actuele waarde */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-widest">
                <BarChart3 className="w-3.5 h-3.5" /> Actuele waarde
              </div>
              <div className="text-lg font-semibold num">
                {formatEuro(portfolioTotal.totalCurrentValue)}
              </div>
            </div>

            {/* Gerealiseerd */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-widest">
                <Award className="w-3.5 h-3.5" /> Gerealiseerd
              </div>
              <MoneyValue
                amount={portfolioTotal.totalRealized}
                signed
                showColor
                className="text-lg font-semibold"
              />
            </div>

            {/* Ongerealiseerd */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-widest">
                <TrendingUp className="w-3.5 h-3.5" /> Ongerealiseerd
              </div>
              <MoneyValue
                amount={portfolioTotal.totalUnrealized}
                signed
                showColor
                className="text-lg font-semibold"
              />
            </div>

            {/* Totaal rendement */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-widest">
                {returnIsPositive ? (
                  <ArrowUpRight className="w-3.5 h-3.5 text-gain" />
                ) : returnIsNegative ? (
                  <ArrowDownRight className="w-3.5 h-3.5 text-loss" />
                ) : (
                  <Minus className="w-3.5 h-3.5" />
                )}{" "}
                Totaal rendement
              </div>
              <div className="flex flex-col gap-0.5">
                <ReturnValue amount={portfolioTotal.totalReturn} className="text-lg font-semibold" />
                <span
                  className={cn(
                    "text-sm num",
                    returnIsPositive
                      ? "text-gain"
                      : returnIsNegative
                        ? "text-loss"
                        : "text-muted-foreground"
                  )}
                >
                  {formatPercent(portfolioTotal.totalReturnPct)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Vier categorie-kaarten ─────────────────────────────────────────── */}
      <section aria-label="Categorieën">
        <h2 className="text-base font-semibold tracking-tight mb-4">Per categorie</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <CategoryCard
            title="Aandelen"
            icon={<TrendingUp className="w-4 h-4 text-white" />}
            iconColor="bg-primary"
            invested={formatEuro(stocksSummary.invested)}
            currentValue={formatEuro(stocksSummary.currentValue)}
            returnEuro={stocksSummary.totalReturn}
            returnPct={stocksSummary.returnPct}
            onClick={() => onNavigate("stocks")}
            delay={0}
          />
          <CategoryCard
            title="Crypto"
            icon={<Coins className="w-4 h-4 text-white" />}
            iconColor="bg-chart-2"
            invested={formatEuro(cryptoSummary.invested)}
            currentValue={formatEuro(cryptoSummary.currentValue)}
            returnEuro={cryptoSummary.totalReturn}
            returnPct={cryptoSummary.returnPct}
            onClick={() => onNavigate("crypto")}
            delay={50}
          />
          <CategoryCard
            title="Grondstoffen"
            icon={<Mountain className="w-4 h-4 text-white" />}
            iconColor="bg-amber-500"
            invested={formatEuro(commoditiesSummary.invested)}
            currentValue={formatEuro(commoditiesSummary.currentValue)}
            returnEuro={commoditiesSummary.totalReturn}
            returnPct={commoditiesSummary.returnPct}
            onClick={() => onNavigate("commodities")}
            delay={100}
          />
          <CategoryCard
            title="Leningen"
            icon={<Handshake className="w-4 h-4 text-white" />}
            iconColor="bg-emerald-600"
            invested={formatEuro(loansSummary.loanedAmount)}
            currentValue={formatEuro(loansSummary.outstanding)}
            returnEuro={loansSummary.totalInterest}
            returnPct={loansSummary.returnPct}
            onClick={() => onNavigate("loans")}
            delay={150}
            investedLabel="Totaal uitgeleend"
            currentValueLabel="Nog uitstaand"
          />
        </div>
      </section>

      {/* ── Grafieken ─────────────────────────────────────────────────────── */}
      <section aria-label="Grafieken">
        <h2 className="text-base font-semibold tracking-tight mb-4">Grafieken</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Grafiek 1: Lijndiagram portefeuillewaarde */}
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 col-span-1 lg:col-span-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-medium text-sm">Portefeuillewaarde over tijd</h3>
                <p className="text-xs text-muted-foreground">Totale waarde per maand</p>
              </div>
              <div className="flex gap-1">
                {(["3M", "6M", "1Y", "ALL"] as TimeFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setTimeFilter(f)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                      timeFilter === f
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {f === "1Y" ? "1J" : f === "ALL" ? "Alles" : f}
                  </button>
                ))}
              </div>
            </div>
            {filteredLineData.length >= 2 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={filteredLineData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "oklch(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: "oklch(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                  />
                  <Tooltip content={<CustomLineTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={CHART_COLORS.stocks}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                Voeg transacties toe om de grafiek te zien.
              </div>
            )}
          </div>

          {/* Grafiek 2: Donut verdeling */}
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
            <div>
              <h3 className="font-medium text-sm">Verdeling portefeuille</h3>
              <p className="text-xs text-muted-foreground">Huidige waarde per categorie</p>
            </div>
            {donutData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {donutData.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.name}`}
                        fill={CHART_COLORS_ARR[index % CHART_COLORS_ARR.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v, name) => [
                      `${formatEuro(v as number)} (${donutData.find((d) => d.name === name)?.pct.toFixed(1)}%)`,
                      name,
                    ]}
                    contentStyle={{
                      background: "oklch(var(--popover))",
                      border: "1px solid oklch(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    formatter={(value, entry) => {
                      const item = donutData.find((d) => d.name === value);
                      return (
                        <span style={{ fontSize: 12, color: "oklch(var(--foreground))" }}>
                          {value} {item ? `${item.pct.toFixed(1)}%` : ""}
                        </span>
                      );
                    }}
                    iconSize={8}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                Geen data beschikbaar.
              </div>
            )}
          </div>

          {/* Grafiek 3: Gerealiseerd rendement per categorie per jaar */}
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
            <div>
              <h3 className="font-medium text-sm">Gerealiseerd rendement per jaar</h3>
              <p className="text-xs text-muted-foreground">Per categorie, in euro</p>
            </div>
            {barChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barChartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 11, fill: "oklch(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: "oklch(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Aandelen" fill={CHART_COLORS.stocks} radius={[3, 3, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="Crypto" fill={CHART_COLORS.crypto} radius={[3, 3, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="Grondstoffen" fill={CHART_COLORS.commodities} radius={[3, 3, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="Leningen" fill={CHART_COLORS.loans} radius={[3, 3, 0, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                Geen gerealiseerde winst of verlies.
              </div>
            )}
          </div>

          {/* Grafiek 4: Rendement vergelijking (horizontaal staafdiagram) */}
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 col-span-1">
            <div>
              <h3 className="font-medium text-sm">Rendement vergelijking</h3>
              <p className="text-xs text-muted-foreground">Totaal rendement % per categorie</p>
            </div>
            {comparisonData.length > 0 ? (
              <div className="flex flex-col gap-3 py-2">
                {comparisonData.map((item) => {
                  const isPos = item.value > 0.005;
                  const isNeg = item.value < -0.005;
                  const absMax = Math.max(...comparisonData.map((d) => Math.abs(d.value)), 1);
                  const pct = clamp((Math.abs(item.value) / absMax) * 100, 0, 100);
                  return (
                    <div key={item.name} className="flex flex-col gap-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{item.name}</span>
                        <span
                          className={cn(
                            "font-semibold num",
                            isPos ? "text-gain" : isNeg ? "text-loss" : "text-muted-foreground"
                          )}
                        >
                          {formatPercent(item.value)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: isPos
                              ? "oklch(var(--gain))"
                              : isNeg
                                ? "oklch(var(--loss))"
                                : item.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                Geen rendement data beschikbaar.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Recente transacties ────────────────────────────────────────────── */}
      {recentTransactions.length > 0 && (
        <section aria-label="Recente transacties">
          <h2 className="text-base font-semibold tracking-tight mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Recente transacties
          </h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                      Datum
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                      Categorie
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                      Naam
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                      Type
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                      Bedrag
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((tx) => (
                    <tr
                      key={`${String(tx.date)}-${tx.name}-${String(tx.type)}`}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => onNavigate(tx.section)}
                    >
                      <td className="px-4 py-3 text-muted-foreground num text-xs whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs">
                          {tx.category === "Aandelen" ? (
                            <TrendingUp className="w-3 h-3 text-primary" />
                          ) : tx.category === "Crypto" ? (
                            <Coins className="w-3 h-3 text-chart-2" />
                          ) : tx.category === "Grondstoffen" ? (
                            <Mountain className="w-3 h-3 text-amber-500" />
                          ) : (
                            <Handshake className="w-3 h-3 text-emerald-500" />
                          )}
                          {tx.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium max-w-[140px] truncate">{tx.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-block px-2 py-0.5 rounded text-xs font-medium",
                            tx.type === TransactionType.buy ||
                              tx.type === LoanTransactionType.repaymentReceived
                              ? "bg-muted text-muted-foreground"
                              : tx.type === TransactionType.sell
                                ? "bg-loss-muted text-loss"
                                : "bg-gain-muted text-gain"
                          )}
                        >
                          {txTypeLabel(tx.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="num text-sm">{formatEuro(tx.amount)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
