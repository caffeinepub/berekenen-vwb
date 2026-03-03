import { cn } from "@/lib/utils";
import { AssetType, type TransactionType } from "../backend.d";
import { isOngoingCostsType } from "../utils/transactionTypes";

interface AssetBadgeProps {
  assetType: AssetType;
  isCommodity?: boolean;
  isEtf?: boolean;
  className?: string;
}

export function AssetBadge({
  assetType,
  isCommodity = false,
  isEtf = false,
  className,
}: AssetBadgeProps) {
  if (isCommodity) {
    return (
      <span
        className={cn(
          "ticker-chip",
          "bg-amber-500/15 text-amber-600 dark:text-amber-400",
          className,
        )}
      >
        Grondstof
      </span>
    );
  }
  const isStock = assetType === AssetType.stock;

  // ETF is a frontend distinction within AssetType.stock
  if (isStock && isEtf) {
    return (
      <span
        className={cn(
          "ticker-chip",
          "bg-blue-500/15 text-blue-600 dark:text-blue-400",
          className,
        )}
      >
        ETF
      </span>
    );
  }

  return (
    <span
      className={cn(
        "ticker-chip",
        isStock
          ? "bg-secondary text-secondary-foreground"
          : "bg-chart-2/15 text-chart-2",
        className,
      )}
    >
      {isStock ? "Aandeel" : "Crypto"}
    </span>
  );
}

interface CommodityBadgeProps {
  className?: string;
}

export function CommodityBadge({ className }: CommodityBadgeProps) {
  return (
    <span
      className={cn(
        "ticker-chip",
        "bg-amber-500/15 text-amber-600 dark:text-amber-400",
        className,
      )}
    >
      Grondstof
    </span>
  );
}

interface TransactionTypeBadgeProps {
  type: TransactionType;
  className?: string;
}

export function TransactionTypeBadge({
  type,
  className,
}: TransactionTypeBadgeProps) {
  // Handle ongoingCosts separately since it's not in the backend.d.ts enum
  if (isOngoingCostsType(type)) {
    return (
      <span
        className={cn(
          "ticker-chip",
          "bg-orange-500/15 text-orange-600 dark:text-orange-400",
          className,
        )}
      >
        Lopende kosten
      </span>
    );
  }

  const config: Record<TransactionType, { label: string; classes: string }> = {
    buy: { label: "Aankoop", classes: "bg-gain/15 text-gain" },
    sell: { label: "Verkoop", classes: "bg-loss/15 text-loss" },
    stakingReward: { label: "Staking", classes: "bg-chart-1/15 text-chart-1" },
    dividend: { label: "Dividend", classes: "bg-chart-4/15 text-chart-4" },
  };
  const entry = config[type] ?? {
    label: String(type),
    classes: "bg-muted text-muted-foreground",
  };
  return (
    <span className={cn("ticker-chip", entry.classes, className)}>
      {entry.label}
    </span>
  );
}
