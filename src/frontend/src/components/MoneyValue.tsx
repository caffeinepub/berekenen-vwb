import { formatEuro, formatEuroSigned, formatPercent } from "../utils/format";
import { cn } from "@/lib/utils";

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

export function ReturnValue({ amount, percentage, className }: ReturnValueProps) {
  const colorClass =
    amount > 0.005
      ? "text-gain"
      : amount < -0.005
        ? "text-loss"
        : "text-muted-foreground";

  return (
    <span className={cn("num flex items-baseline gap-1.5", colorClass, className)}>
      <span>{formatEuroSigned(amount)}</span>
      {percentage !== undefined && (
        <span className="text-xs opacity-75">{formatPercent(percentage)}</span>
      )}
    </span>
  );
}
