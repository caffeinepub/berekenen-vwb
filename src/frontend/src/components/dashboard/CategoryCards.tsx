import { cn } from "@/lib/utils";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Coins,
  Handshake,
  Minus,
  Mountain,
  TrendingUp,
} from "lucide-react";
import type { Section } from "../../context/AppContext";
import {
  formatEuro,
  formatEuroSigned,
  formatPercent,
} from "../../utils/format";

interface CategorySummary {
  invested: number;
  currentValue: number;
  returnEuro: number;
  returnPct: number;
}

interface LoanSummary {
  loanedAmount: number;
  outstanding: number;
  totalInterest: number;
  returnPct: number;
}

interface CategoryCardsProps {
  stocks: CategorySummary;
  crypto: CategorySummary;
  commodities: CategorySummary;
  loans: LoanSummary;
  onNavigate: (
    section: Extract<Section, "stocks" | "crypto" | "commodities" | "loans">,
  ) => void;
}

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
        "opacity-0 animate-fade-in-up",
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center",
              iconColor,
            )}
          >
            {icon}
          </span>
          <span className="font-semibold text-sm">{title}</span>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground mb-0.5 truncate">
            {investedLabel}
          </div>
          <div className="text-sm font-medium num truncate">{invested}</div>
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground mb-0.5 truncate">
            {currentValueLabel}
          </div>
          <div className="text-sm font-medium num truncate">{currentValue}</div>
        </div>
      </div>

      <div
        className={cn(
          "rounded-lg px-3 py-2",
          isPositive
            ? "bg-gain-muted"
            : isNegative
              ? "bg-loss-muted"
              : "bg-muted/50",
        )}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">Rendement</span>
          {isPositive ? (
            <ArrowUpRight className="w-3.5 h-3.5 text-gain flex-shrink-0" />
          ) : isNegative ? (
            <ArrowDownRight className="w-3.5 h-3.5 text-loss flex-shrink-0" />
          ) : (
            <Minus className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          )}
        </div>
        <div className="flex items-baseline justify-between gap-1 flex-wrap">
          <span
            className={cn(
              "text-sm font-semibold num truncate",
              isPositive
                ? "text-gain"
                : isNegative
                  ? "text-loss"
                  : "text-muted-foreground",
            )}
          >
            {formatEuroSigned(returnEuro)}
          </span>
          <span
            className={cn(
              "text-xs num flex-shrink-0",
              isPositive
                ? "text-gain"
                : isNegative
                  ? "text-loss"
                  : "text-muted-foreground",
            )}
          >
            {formatPercent(returnPct)}
          </span>
        </div>
      </div>
    </button>
  );
}

export function CategoryCards({
  stocks,
  crypto,
  commodities,
  loans,
  onNavigate,
}: CategoryCardsProps) {
  return (
    <section aria-label="Categorieën">
      <h2 className="text-base font-semibold tracking-tight mb-4">
        Per categorie
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CategoryCard
          title="Aandelen"
          icon={<TrendingUp className="w-4 h-4 text-white" />}
          iconColor="bg-primary"
          invested={formatEuro(stocks.invested)}
          currentValue={formatEuro(stocks.currentValue)}
          returnEuro={stocks.returnEuro}
          returnPct={stocks.returnPct}
          onClick={() => onNavigate("stocks")}
          delay={0}
        />
        <CategoryCard
          title="Crypto"
          icon={<Coins className="w-4 h-4 text-white" />}
          iconColor="bg-chart-2"
          invested={formatEuro(crypto.invested)}
          currentValue={formatEuro(crypto.currentValue)}
          returnEuro={crypto.returnEuro}
          returnPct={crypto.returnPct}
          onClick={() => onNavigate("crypto")}
          delay={50}
        />
        <CategoryCard
          title="Grondstoffen"
          icon={<Mountain className="w-4 h-4 text-white" />}
          iconColor="bg-amber-500"
          invested={formatEuro(commodities.invested)}
          currentValue={formatEuro(commodities.currentValue)}
          returnEuro={commodities.returnEuro}
          returnPct={commodities.returnPct}
          onClick={() => onNavigate("commodities")}
          delay={100}
        />
        <CategoryCard
          title="Leningen"
          icon={<Handshake className="w-4 h-4 text-white" />}
          iconColor="bg-emerald-600"
          invested={formatEuro(loans.loanedAmount)}
          currentValue={formatEuro(loans.outstanding)}
          returnEuro={loans.totalInterest}
          returnPct={loans.returnPct}
          onClick={() => onNavigate("loans")}
          delay={150}
          investedLabel="Totaal uitgeleend"
          currentValueLabel="Nog uitstaand"
        />
      </div>
    </section>
  );
}
