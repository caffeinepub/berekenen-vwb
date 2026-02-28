import { cn } from "@/lib/utils";
import { formatEuro, formatEuroSigned, formatPercent } from "../utils/format";

interface MoneyValueProps {
  amount: number;
  signed?: boolean;
  className?: string;
  showColor?: boolean;
}

export function MoneyValue({
  amount,
  signed = false,
  className,
  showColor = false,
}: MoneyValueProps) {
  const colorClass =
    showColor || signed
      ? amount > 0.005
        ? "text-gain"
        : amount < -0.005
          ? "text-loss"
          : "text-muted-foreground"
      : "";

  return (
    <span className={cn("num", colorClass, className)}>
      {signed ? formatEuroSigned(amount) : formatEuro(amount)}
    </span>
  );
}

interface ReturnValueProps {
  amount: number;
  percentage?: number;
  className?: string;
}

export function ReturnValue({
  amount,
  percentage,
  className,
}: ReturnValueProps) {
  const colorClass =
    amount > 0.005
      ? "text-gain"
      : amount < -0.005
        ? "text-loss"
        : "text-muted-foreground";

  return (
    <span
      className={cn(
        "num flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5",
        colorClass,
        className,
      )}
    >
      <span className="shrink-0">{formatEuroSigned(amount)}</span>
      {percentage !== undefined && (
        <span className="text-xs opacity-75 shrink-0">
          {formatPercent(percentage)}
        </span>
      )}
    </span>
  );
}
