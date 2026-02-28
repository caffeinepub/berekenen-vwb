import { cn } from "@/lib/utils";
import {
  ArrowDownRight,
  ArrowUpRight,
  Award,
  BarChart3,
  Minus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { formatEuro, formatPercent } from "../../utils/format";
import { MoneyValue, ReturnValue } from "../MoneyValue";

interface PortfolioTotal {
  totalInvested: number;
  totalCurrentValue: number;
  totalRealized: number;
  totalUnrealized: number;
  totalReturn: number;
  totalReturnPct: number;
}

interface TotalCardProps {
  totals: PortfolioTotal;
}

export function TotalCard({ totals }: TotalCardProps) {
  const {
    totalInvested,
    totalCurrentValue,
    totalRealized,
    totalUnrealized,
    totalReturn,
    totalReturnPct,
  } = totals;
  const isPositive = totalReturn > 0.005;
  const isNegative = totalReturn < -0.005;

  return (
    <section aria-label="Totaaloverzicht portefeuille">
      <div
        className={cn(
          "rounded-2xl border p-6 bg-card",
          isPositive
            ? "border-gain/30"
            : isNegative
              ? "border-loss/30"
              : "border-border",
        )}
      >
        <div className="flex items-center gap-2 mb-5">
          {isPositive ? (
            <TrendingUp className="w-5 h-5 text-gain" />
          ) : isNegative ? (
            <TrendingDown className="w-5 h-5 text-loss" />
          ) : (
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
          )}
          <h2 className="font-semibold text-base">Totaaloverzicht</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-widest">
              <Wallet className="w-3.5 h-3.5" /> Inleg
            </div>
            <div className="text-lg font-semibold num">
              {formatEuro(totalInvested)}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-widest">
              <BarChart3 className="w-3.5 h-3.5" /> Actuele waarde
            </div>
            <div className="text-lg font-semibold num">
              {formatEuro(totalCurrentValue)}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-widest">
              <Award className="w-3.5 h-3.5" /> Gerealiseerd
            </div>
            <MoneyValue
              amount={totalRealized}
              signed
              showColor
              className="text-lg font-semibold"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-widest">
              <TrendingUp className="w-3.5 h-3.5" /> Ongerealiseerd
            </div>
            <MoneyValue
              amount={totalUnrealized}
              signed
              showColor
              className="text-lg font-semibold"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-widest">
              {isPositive ? (
                <ArrowUpRight className="w-3.5 h-3.5 text-gain" />
              ) : isNegative ? (
                <ArrowDownRight className="w-3.5 h-3.5 text-loss" />
              ) : (
                <Minus className="w-3.5 h-3.5" />
              )}{" "}
              Totaal rendement
            </div>
            <div className="flex flex-col gap-0.5">
              <ReturnValue
                amount={totalReturn}
                className="text-lg font-semibold"
              />
              <span
                className={cn(
                  "text-sm num",
                  isPositive
                    ? "text-gain"
                    : isNegative
                      ? "text-loss"
                      : "text-muted-foreground",
                )}
              >
                {formatPercent(totalReturnPct)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
