import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AssetType,
  type AssetView,
  LoanTransactionType,
  type LoanView,
  TransactionType,
} from "../../backend.d";
import { calculateFifo } from "../../utils/fifo";
import { formatEuro, formatPercent, timeToDate } from "../../utils/format";

type TimeFilter = "3M" | "6M" | "1Y" | "ALL";

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

function getMonthLabel(date: Date) {
  return date.toLocaleDateString("nl-NL", { month: "short", year: "2-digit" });
}

function getYear(time: bigint) {
  return timeToDate(time).getFullYear();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function CustomLineTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <div className="font-medium text-foreground mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: p.color }}
          />
          <span className="text-muted-foreground">
            {p.name === "value" ? "Waarde" : "Inleg"}:
          </span>
          <span className="text-foreground font-semibold num">
            {formatEuro(p.value)}
          </span>
        </div>
      ))}
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
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: p.fill }}
          />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold num">{formatEuro(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

type ChartsFifoMap = Map<string, ReturnType<typeof calculateFifo>>;

function categorySummary(assetList: AssetView[], fm: ChartsFifoMap) {
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

interface PortfolioChartsProps {
  assets: AssetView[];
  loans: LoanView[];
  commodityTickers: Set<string>;
}

export function PortfolioCharts({
  assets,
  loans,
  commodityTickers,
}: PortfolioChartsProps) {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("ALL");

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
    () => categorySummary(stockAssets, fifoMap),
    [stockAssets, fifoMap],
  );
  const cryptoSummary = useMemo(
    () => categorySummary(cryptoAssets, fifoMap),
    [cryptoAssets, fifoMap],
  );
  const commoditiesSummary = useMemo(
    () => categorySummary(commodityAssets, fifoMap),
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
    const outstanding = loanedAmount - totalRepayments;
    const returnPct =
      loanedAmount > 0 ? (totalInterest / loanedAmount) * 100 : 0;
    return {
      loanedAmount,
      totalRepayments,
      outstanding,
      totalInterest,
      returnPct,
    };
  }, [loans]);

  // Grafiek 1: lijndiagram (waarde + inleg over tijd)
  const lineChartData = useMemo(() => {
    const allDates: Date[] = [];
    for (const asset of assets)
      for (const tx of asset.transactions) allDates.push(timeToDate(tx.date));
    for (const loan of loans) {
      allDates.push(timeToDate(loan.startDate));
      for (const ltx of loan.transactions) allDates.push(timeToDate(ltx.date));
    }
    if (allDates.length === 0) return [];

    const earliest = allDates.reduce((a, b) => (a < b ? a : b));
    const now = new Date();
    const months: Date[] = [];
    const cur = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    while (cur <= end) {
      months.push(new Date(cur));
      cur.setMonth(cur.getMonth() + 1);
    }

    return months.map((monthStart) => {
      const monthEndMs = new Date(
        monthStart.getFullYear(),
        monthStart.getMonth() + 1,
        0,
      ).getTime();

      let totalValue = 0;
      let totalInleg = 0;

      for (const asset of assets) {
        let qty = 0;
        let inleg = 0;
        for (const tx of asset.transactions) {
          const txMs = Number(tx.date / 1_000_000n);
          if (txMs <= monthEndMs) {
            if (tx.transactionType === TransactionType.buy) {
              qty += tx.quantity;
              inleg += tx.quantity * tx.pricePerUnit + (tx.fees ?? 0);
            } else if (tx.transactionType === TransactionType.sell) {
              // Reduce inleg proportionally (FIFO approximation for chart)
              const sellFraction = qty > 0 ? tx.quantity / qty : 0;
              inleg -= inleg * sellFraction;
              qty -= tx.quantity;
            } else if (tx.transactionType === TransactionType.stakingReward) {
              qty += tx.quantity;
            }
          }
        }
        totalValue += Math.max(0, qty) * asset.currentPrice;
        totalInleg += Math.max(0, inleg);
      }

      for (const loan of loans) {
        if (Number(loan.startDate / 1_000_000n) <= monthEndMs) {
          let repaid = 0;
          for (const ltx of loan.transactions) {
            if (
              Number(ltx.date / 1_000_000n) <= monthEndMs &&
              ltx.transactionType === LoanTransactionType.repaymentReceived
            )
              repaid += ltx.amount;
          }
          const outstanding = Math.max(0, loan.loanedAmount - repaid);
          totalValue += outstanding;
          totalInleg += outstanding;
        }
      }

      return {
        label: getMonthLabel(monthStart),
        value: totalValue,
        inleg: totalInleg,
      };
    });
  }, [assets, loans]);

  const filteredLineData = useMemo(() => {
    if (timeFilter === "ALL" || lineChartData.length === 0)
      return lineChartData;
    const months = timeFilter === "3M" ? 3 : timeFilter === "6M" ? 6 : 12;
    return lineChartData.slice(Math.max(0, lineChartData.length - months));
  }, [lineChartData, timeFilter]);

  // Grafiek 2: donut
  const donutData = useMemo(() => {
    const data = [
      { name: "Aandelen", value: stocksSummary.currentValue },
      { name: "Crypto", value: cryptoSummary.currentValue },
      { name: "Grondstoffen", value: commoditiesSummary.currentValue },
      { name: "Leningen", value: loansSummary.outstanding },
    ].filter((d) => d.value > 0);
    const total = data.reduce((s, d) => s + d.value, 0);
    return data.map((d) => ({
      ...d,
      pct: total > 0 ? (d.value / total) * 100 : 0,
    }));
  }, [stocksSummary, cryptoSummary, commoditiesSummary, loansSummary]);

  // Grafiek 3: gerealiseerd per jaar
  const barChartData = useMemo(() => {
    const yearsSet = new Set<number>();
    for (const asset of assets)
      for (const tx of asset.transactions) yearsSet.add(getYear(tx.date));
    for (const loan of loans)
      for (const ltx of loan.transactions) yearsSet.add(getYear(ltx.date));
    if (yearsSet.size === 0) return [];
    return Array.from(yearsSet)
      .sort()
      .map((year) => {
        let stocksR = 0;
        let cryptoR = 0;
        let commoditiesR = 0;
        for (const asset of stockAssets) {
          for (const tx of asset.transactions) {
            if (getYear(tx.date) !== year) continue;
            if (tx.transactionType === TransactionType.sell)
              stocksR += tx.quantity * tx.pricePerUnit - (tx.fees ?? 0);
            else if (tx.transactionType === TransactionType.dividend)
              stocksR += tx.euroValue ?? 0;
          }
        }
        for (const asset of cryptoAssets) {
          for (const tx of asset.transactions) {
            if (getYear(tx.date) !== year) continue;
            if (tx.transactionType === TransactionType.sell)
              cryptoR += tx.quantity * tx.pricePerUnit - (tx.fees ?? 0);
            else if (tx.transactionType === TransactionType.stakingReward)
              cryptoR += tx.euroValue ?? 0;
          }
        }
        for (const asset of commodityAssets) {
          for (const tx of asset.transactions) {
            if (getYear(tx.date) !== year) continue;
            if (tx.transactionType === TransactionType.sell)
              commoditiesR += tx.quantity * tx.pricePerUnit - (tx.fees ?? 0);
          }
        }
        const loansR = loans.reduce(
          (sum, loan) =>
            sum +
            loan.transactions
              .filter(
                (ltx) =>
                  getYear(ltx.date) === year &&
                  ltx.transactionType === LoanTransactionType.interestReceived,
              )
              .reduce((s, ltx) => s + ltx.amount, 0),
          0,
        );
        return {
          year: String(year),
          Aandelen: stocksR,
          Crypto: cryptoR,
          Grondstoffen: commoditiesR,
          Leningen: loansR,
        };
      });
  }, [assets, loans, stockAssets, cryptoAssets, commodityAssets]); // eslint-disable-line react-hooks/exhaustive-deps

  // Grafiek 4: rendement vergelijking
  const comparisonData = useMemo(
    () =>
      [
        {
          name: "Aandelen",
          value: stocksSummary.returnPct,
          color: CHART_COLORS.stocks,
          invested: stocksSummary.invested,
        },
        {
          name: "Crypto",
          value: cryptoSummary.returnPct,
          color: CHART_COLORS.crypto,
          invested: cryptoSummary.invested,
        },
        {
          name: "Grondstoffen",
          value: commoditiesSummary.returnPct,
          color: CHART_COLORS.commodities,
          invested: commoditiesSummary.invested,
        },
        {
          name: "Leningen",
          value: loansSummary.returnPct,
          color: CHART_COLORS.loans,
          invested: loansSummary.loanedAmount,
        },
      ].filter((d) => d.value !== 0 || d.invested > 0),
    [stocksSummary, cryptoSummary, commoditiesSummary, loansSummary],
  );

  return (
    <section aria-label="Grafieken">
      <h2 className="text-base font-semibold tracking-tight mb-4">Grafieken</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lijndiagram */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-medium text-sm">
                Portefeuillewaarde over tijd
              </h3>
              <p className="text-xs text-muted-foreground">
                Totale waarde en inleg per maand
              </p>
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
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f === "1Y" ? "1J" : f === "ALL" ? "Alles" : f}
                </button>
              ))}
            </div>
          </div>
          {filteredLineData.length >= 2 ? (
            <div className="relative">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={filteredLineData}
                  margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="oklch(var(--border))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{
                      fontSize: 11,
                      fill: "oklch(var(--muted-foreground))",
                    }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
                    tick={{
                      fontSize: 11,
                      fill: "oklch(var(--muted-foreground))",
                    }}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                  />
                  <Tooltip content={<CustomLineTooltip />} />
                  <Legend
                    formatter={(value) => (
                      <span
                        style={{
                          fontSize: 11,
                          color: "oklch(var(--foreground))",
                        }}
                      >
                        {value === "value" ? "Waarde" : "Inleg"}
                      </span>
                    )}
                    iconSize={8}
                    iconType="circle"
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name="value"
                    stroke={CHART_COLORS.stocks}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="inleg"
                    name="inleg"
                    stroke={CHART_COLORS.commodities}
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              {/* Totaal rendement % rechtsonder */}
              {(() => {
                const last = filteredLineData[filteredLineData.length - 1];
                if (!last || last.inleg <= 0) return null;
                const returnPct =
                  ((last.value - last.inleg) / last.inleg) * 100;
                const isPos = returnPct > 0.005;
                const isNeg = returnPct < -0.005;
                return (
                  <div className="absolute bottom-2 right-3 text-xs font-semibold num">
                    <span
                      className={cn(
                        isPos
                          ? "text-gain"
                          : isNeg
                            ? "text-loss"
                            : "text-muted-foreground",
                      )}
                    >
                      Totaal rendement: {returnPct >= 0 ? "+" : ""}
                      {returnPct.toFixed(2)}%
                    </span>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              Voeg transacties toe om de grafiek te zien.
            </div>
          )}
        </div>

        {/* Donut */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
          <div>
            <h3 className="font-medium text-sm">Verdeling portefeuille</h3>
            <p className="text-xs text-muted-foreground">
              Huidige waarde per categorie
            </p>
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
                  formatter={(value) => {
                    const item = donutData.find((d) => d.name === value);
                    return (
                      <span
                        style={{
                          fontSize: 12,
                          color: "oklch(var(--foreground))",
                        }}
                      >
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

        {/* Staafdiagram gerealiseerd */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
          <div>
            <h3 className="font-medium text-sm">
              Gerealiseerd rendement per jaar
            </h3>
            <p className="text-xs text-muted-foreground">
              Per categorie, in euro
            </p>
          </div>
          {barChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={barChartData}
                margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="oklch(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="year"
                  tick={{
                    fontSize: 11,
                    fill: "oklch(var(--muted-foreground))",
                  }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
                  tick={{
                    fontSize: 11,
                    fill: "oklch(var(--muted-foreground))",
                  }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Legend
                  iconSize={8}
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11 }}
                />
                <Bar
                  dataKey="Aandelen"
                  fill={CHART_COLORS.stocks}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={20}
                />
                <Bar
                  dataKey="Crypto"
                  fill={CHART_COLORS.crypto}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={20}
                />
                <Bar
                  dataKey="Grondstoffen"
                  fill={CHART_COLORS.commodities}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={20}
                />
                <Bar
                  dataKey="Leningen"
                  fill={CHART_COLORS.loans}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              Geen gerealiseerde winst of verlies.
            </div>
          )}
        </div>

        {/* Rendement vergelijking */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 col-span-1 lg:col-span-2">
          <div>
            <h3 className="font-medium text-sm">Rendement vergelijking</h3>
            <p className="text-xs text-muted-foreground">
              Totaal rendement % per categorie
            </p>
          </div>
          {comparisonData.length > 0 ? (
            <div className="flex flex-col gap-3 py-2">
              {comparisonData.map((item) => {
                const isPos = item.value > 0.005;
                const isNeg = item.value < -0.005;
                const absMax = Math.max(
                  ...comparisonData.map((d) => Math.abs(d.value)),
                  1,
                );
                const pct = clamp(
                  (Math.abs(item.value) / absMax) * 100,
                  0,
                  100,
                );
                return (
                  <div key={item.name} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{item.name}</span>
                      <span
                        className={cn(
                          "font-semibold num",
                          isPos
                            ? "text-gain"
                            : isNeg
                              ? "text-loss"
                              : "text-muted-foreground",
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
  );
}
