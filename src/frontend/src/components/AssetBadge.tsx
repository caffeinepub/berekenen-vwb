import { AssetType } from "../backend.d";
import { cn } from "@/lib/utils";

interface AssetBadgeProps {
  assetType: AssetType;
  className?: string;
}

export function AssetBadge({ assetType, className }: AssetBadgeProps) {
  const isStock = assetType === AssetType.stock;
  return (
    <span
      className={cn(
        "ticker-chip",
        isStock
          ? "bg-secondary text-secondary-foreground"
          : "bg-chart-2/15 text-chart-2",
        className
      )}
    >
      {isStock ? "Aandeel" : "Crypto"}
    </span>
  );
}

interface TransactionTypeBadgeProps {
  type: "buy" | "sell" | "stakingReward";
  className?: string;
}

export function TransactionTypeBadge({ type, className }: TransactionTypeBadgeProps) {
  const config = {
    buy: { label: "Aankoop", classes: "bg-gain/15 text-gain" },
    sell: { label: "Verkoop", classes: "bg-loss/15 text-loss" },
    stakingReward: { label: "Staking", classes: "bg-chart-1/15 text-chart-1" },
  };
  const { label, classes } = config[type];
  return (
    <span className={cn("ticker-chip", classes, className)}>
      {label}
    </span>
  );
}
