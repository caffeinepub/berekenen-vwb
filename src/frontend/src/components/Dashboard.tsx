import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Award,
  BarChart3,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { AssetView } from "../backend.d";
import { type PortfolioSummary, calculateFifo } from "../utils/fifo";
import { formatEuro, formatPercent } from "../utils/format";
import { MoneyValue, ReturnValue } from "./MoneyValue";

interface DashboardProps {
  assets: AssetView[];
  isLoading: boolean;
}

function computeSummary(assets: AssetView[]): PortfolioSummary {
  let totalInvested = 0;
  let totalCurrentValue = 0;
  let totalRealized = 0;
  let totalUnrealized = 0;

  for (const asset of assets) {
    const fifo = calculateFifo(asset.transactions, asset.currentPrice);
    totalInvested += fifo.netInvested;
    totalCurrentValue += fifo.currentQuantity * asset.currentPrice;
    totalRealized += fifo.realized;
    totalUnrealized += fifo.unrealized;
  }

  const totalReturn = totalRealized + totalUnrealized;
  const totalReturnPct =
    totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

  return {
    totalInvested,
    totalCurrentValue,
    totalRealized,
    totalUnrealized,
    totalReturn,
    totalReturnPct,
  };
}

interface SummaryCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  className?: string;
  delay?: number;
}

function SummaryCard({
  label,
  value,
  icon,
  className,
  delay = 0,
}: SummaryCardProps) {
  return (
    <div
      className={cn(
        "bg-card border border-border rounded-lg p-5 flex flex-col gap-3 opacity-0 animate-fade-in-up",
        className,
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className="text-muted-foreground/50">{icon}</span>
      </div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

export function Dashboard({ assets, isLoading }: DashboardProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {["inv", "cur", "real", "unreal", "total"].map((key) => (
          <div
            key={key}
            className="bg-card border border-border rounded-lg p-5 flex flex-col gap-3"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-32" />
          </div>
        ))}
      </div>
    );
  }

  const summary = computeSummary(assets);
  const returnIsPositive = summary.totalReturn > 0.005;
  const returnIsNegative = summary.totalReturn < -0.005;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <SummaryCard
        label="Inleg"
        icon={<Wallet className="w-4 h-4" />}
        value={
          <MoneyValue
            amount={summary.totalInvested}
            className="text-xl font-semibold"
          />
        }
        delay={0}
      />
      <SummaryCard
        label="Actuele waarde"
        icon={<BarChart3 className="w-4 h-4" />}
        value={
          <MoneyValue
            amount={summary.totalCurrentValue}
            className="text-xl font-semibold"
          />
        }
        delay={50}
      />
      <SummaryCard
        label="Gerealiseerd"
        icon={<Award className="w-4 h-4" />}
        value={
          <ReturnValue
            amount={summary.totalRealized}
            className="text-xl font-semibold"
          />
        }
        delay={100}
      />
      <SummaryCard
        label="Ongerealiseerd"
        icon={<TrendingUp className="w-4 h-4" />}
        value={
          <ReturnValue
            amount={summary.totalUnrealized}
            className="text-xl font-semibold"
          />
        }
        delay={150}
      />
      <SummaryCard
        label="Totaal rendement"
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
              amount={summary.totalReturn}
              className="text-xl font-semibold"
            />
            <span
              className={cn(
                "text-sm num",
                returnIsPositive
                  ? "text-gain"
                  : returnIsNegative
                    ? "text-loss"
                    : "text-muted-foreground",
              )}
            >
              {formatPercent(summary.totalReturnPct)}
            </span>
          </div>
        }
        delay={200}
        className={cn(
          returnIsPositive && "border-gain/30",
          returnIsNegative && "border-loss/30",
        )}
      />
    </div>
  );
}
