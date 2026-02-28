import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Calendar,
  Coins,
  FileSpreadsheet,
  FileText,
  Inbox,
  Landmark,
  Percent,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  AssetType,
  type AssetView,
  type LoanView,
  TransactionType,
} from "../backend.d";
import { exportPdf, exportXlsx } from "../utils/exportHelpers";
import {
  formatDate,
  formatEuro,
  formatPercent,
  formatQuantity,
} from "../utils/format";
import { computeYearStats, getYearTransactions } from "../utils/yearStats";
import { TransactionTypeBadge } from "./AssetBadge";
import { MoneyValue, ReturnValue } from "./MoneyValue";

interface YearOverviewProps {
  assets: AssetView[];
  terMap: Record<string, number>;
  commodityTickers?: Set<string>;
  loans?: LoanView[];
}

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  className?: string;
}

function StatCard({ label, value, icon, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "bg-card border border-border rounded-lg p-4 flex flex-col gap-2",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className="text-muted-foreground/50">{icon}</span>
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

export function YearOverview({
  assets,
  terMap,
  commodityTickers,
  loans = [],
}: YearOverviewProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: currentYear - 2019 },
    (_, i) => currentYear - i,
  );
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const stats = useMemo(
    () => computeYearStats(assets, selectedYear, terMap, loans),
    [assets, selectedYear, terMap, loans],
  );

  const yearTxs = useMemo(
    () => getYearTransactions(assets, selectedYear),
    [assets, selectedYear],
  );

  const hasTxTerCosts = stats.txTerCosts > 0;
  const hasDividend = stats.totalDividend > 0;
  const hasStaking = stats.totalStaking > 0;
  const hasLoanInterest = stats.totalLoanInterest > 0;
  const returnIsPositive = stats.netReturn > 0.005;
  const returnIsNegative = stats.netReturn < -0.005;

  return (
    <section
      aria-labelledby="year-overview-heading"
      className="flex flex-col gap-4"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <h3
            id="year-overview-heading"
            className="text-base font-semibold tracking-tight"
          >
            Overzicht
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={() =>
              exportXlsx(selectedYear, stats, yearTxs, commodityTickers)
            }
            title="Exporteren als Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            XLSX
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={() =>
              exportPdf(selectedYear, stats, yearTxs, commodityTickers)
            }
            title="Exporteren als PDF"
          >
            <FileText className="w-3.5 h-3.5" />
            PDF
          </Button>
          <Select
            value={String(selectedYear)}
            onValueChange={(v) => setSelectedYear(Number(v))}
          >
            <SelectTrigger className="w-28 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard
          label="Inleg"
          icon={<Wallet className="w-4 h-4" />}
          value={
            <MoneyValue
              amount={stats.totalInvested}
              className="text-lg font-semibold"
            />
          }
        />
        <StatCard
          label="Verkopen"
          icon={<BarChart3 className="w-4 h-4" />}
          value={
            <MoneyValue
              amount={stats.totalSales}
              className="text-lg font-semibold"
            />
          }
        />
        <StatCard
          label="Transactiekosten"
          icon={<Receipt className="w-4 h-4" />}
          value={
            <MoneyValue
              amount={stats.totalFees}
              className="text-lg font-semibold"
            />
          }
        />
        <StatCard
          label="Gerealiseerd"
          icon={<TrendingUp className="w-4 h-4" />}
          value={
            <ReturnValue
              amount={stats.realizedPnL}
              className="text-lg font-semibold"
            />
          }
        />
        <StatCard
          label="Ongerealiseerd"
          icon={<TrendingUp className="w-4 h-4" />}
          value={
            <ReturnValue
              amount={stats.unrealizedPnL}
              className="text-lg font-semibold"
            />
          }
        />
        {hasDividend && (
          <StatCard
            label="Ontvangen dividend"
            icon={<Landmark className="w-4 h-4" />}
            value={
              <ReturnValue
                amount={stats.totalDividend}
                className="text-lg font-semibold"
              />
            }
          />
        )}
        {hasStaking && (
          <StatCard
            label="Ontvangen staking"
            icon={<Coins className="w-4 h-4" />}
            value={
              <ReturnValue
                amount={stats.totalStaking}
                className="text-lg font-semibold"
              />
            }
          />
        )}
        {hasLoanInterest && (
          <StatCard
            label="Rente leningen"
            icon={<Landmark className="w-4 h-4" />}
            value={
              <ReturnValue
                amount={stats.totalLoanInterest}
                className="text-lg font-semibold"
              />
            }
          />
        )}
        {hasTxTerCosts && (
          <StatCard
            label="Lopende kosten (ETF) – totaal huidige waarde"
            icon={<Percent className="w-4 h-4" />}
            value={
              <span className="num text-lg font-semibold text-loss">
                -{formatEuro(stats.txTerCosts)}
              </span>
            }
          />
        )}
        <StatCard
          label="Netto rendement"
          icon={
            returnIsPositive ? (
              <TrendingUp className="w-4 h-4 text-gain" />
            ) : returnIsNegative ? (
              <TrendingDown className="w-4 h-4 text-loss" />
            ) : (
              <TrendingUp className="w-4 h-4" />
            )
          }
          value={
            <div className="flex flex-col gap-0.5">
              <ReturnValue
                amount={stats.netReturn}
                className="text-lg font-semibold"
              />
              <span
                className={cn(
                  "text-xs num",
                  returnIsPositive
                    ? "text-gain"
                    : returnIsNegative
                      ? "text-loss"
                      : "text-muted-foreground",
                )}
              >
                {formatPercent(stats.netReturnPct)}
              </span>
            </div>
          }
          className={cn(
            returnIsPositive && "border-gain/30",
            returnIsNegative && "border-loss/30",
          )}
        />
      </div>

      {yearTxs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center bg-card border border-border rounded-lg">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Inbox className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">
              Geen transacties in {selectedYear}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Er zijn geen transacties gevonden voor dit jaar.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-medium">
              Transacties {selectedYear}{" "}
              <span className="text-muted-foreground font-normal">
                ({yearTxs.length})
              </span>
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider">
                    Datum
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    Asset
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    Sectie
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    Type
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-right">
                    Aantal
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-right">
                    Prijs/stuk
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-right">
                    Kosten
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-right">
                    Winst/Verlies
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {yearTxs.map((tx, idx) => {
                  const isCrypto = tx.assetType === AssetType.crypto;
                  const isCommodityTx = !!commodityTickers?.has(tx.assetTicker);
                  return (
                    <TableRow
                      key={`${tx.date}-${tx.assetTicker}-${idx}`}
                      className="hover:bg-accent/30"
                    >
                      <TableCell className="num text-xs text-muted-foreground py-2.5">
                        {formatDate(tx.date)}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-xs">
                            {tx.assetTicker}
                          </span>
                          <span className="text-muted-foreground text-xs hidden sm:inline">
                            {tx.assetName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0",
                            isCrypto
                              ? "border-chart-2/50 text-chart-2"
                              : isCommodityTx
                                ? "border-amber-500/50 text-amber-600 dark:text-amber-400"
                                : "border-primary/50 text-primary",
                          )}
                        >
                          {isCrypto
                            ? "Crypto"
                            : isCommodityTx
                              ? "Grondstof"
                              : "Aandeel"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <TransactionTypeBadge type={tx.transactionType} />
                      </TableCell>
                      <TableCell className="num text-right py-2.5">
                        {tx.transactionType === TransactionType.dividend ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          formatQuantity(tx.quantity, isCrypto)
                        )}
                      </TableCell>
                      <TableCell className="num text-right py-2.5">
                        {tx.transactionType === TransactionType.stakingReward ||
                        tx.transactionType === TransactionType.dividend ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          formatEuro(tx.pricePerUnit, 4)
                        )}
                      </TableCell>
                      <TableCell className="num text-right py-2.5 text-muted-foreground">
                        {tx.fees ? formatEuro(tx.fees) : "—"}
                      </TableCell>
                      <TableCell className="text-right py-2.5">
                        {tx.realizedProfit !== undefined ? (
                          <ReturnValue amount={tx.realizedProfit} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(() => {
                  const totalFees = yearTxs.reduce(
                    (s, tx) => s + (tx.fees ?? 0),
                    0,
                  );
                  const totalPnL = yearTxs.reduce(
                    (s, tx) => s + (tx.realizedProfit ?? 0),
                    0,
                  );
                  return (
                    <TableRow className="bg-muted/50 font-semibold border-t border-border">
                      <TableCell className="py-2.5 text-xs font-semibold">
                        Totaal
                      </TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell />
                      <TableCell />
                      <TableCell />
                      <TableCell className="num text-right py-2.5">
                        {totalFees > 0 ? formatEuro(totalFees) : "—"}
                      </TableCell>
                      <TableCell className="text-right py-2.5">
                        <ReturnValue amount={totalPnL} />
                      </TableCell>
                    </TableRow>
                  );
                })()}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </section>
  );
}
