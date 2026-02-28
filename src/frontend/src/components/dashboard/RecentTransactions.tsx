import { cn } from "@/lib/utils";
import { Clock, Coins, Handshake, Mountain, TrendingUp } from "lucide-react";
import {
  AssetType,
  type AssetView,
  LoanTransactionType,
  type LoanView,
  TransactionType,
} from "../../backend.d";
import type { Section } from "../../context/AppContext";
import { formatDate, formatEuro } from "../../utils/format";

interface RecentTx {
  date: bigint;
  category: string;
  name: string;
  type: TransactionType | LoanTransactionType;
  amount: number;
  section: Extract<Section, "stocks" | "crypto" | "commodities" | "loans">;
}

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

interface RecentTransactionsProps {
  assets: AssetView[];
  loans: LoanView[];
  commodityTickers: Set<string>;
  onNavigate: (
    section: Extract<Section, "stocks" | "crypto" | "commodities" | "loans">,
  ) => void;
}

export function RecentTransactions({
  assets,
  loans,
  commodityTickers,
  onNavigate,
}: RecentTransactionsProps) {
  const txs: RecentTx[] = [];

  for (const asset of assets) {
    const section: "stocks" | "crypto" | "commodities" =
      asset.assetType === AssetType.crypto
        ? "crypto"
        : commodityTickers.has(asset.ticker)
          ? "commodities"
          : "stocks";
    const category =
      section === "stocks"
        ? "Aandelen"
        : section === "crypto"
          ? "Crypto"
          : "Grondstoffen";

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

  const recent = txs.sort((a, b) => Number(b.date - a.date)).slice(0, 8);

  if (recent.length === 0) return null;

  return (
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
                {["Datum", "Categorie", "Naam", "Type"].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3"
                  >
                    {h}
                  </th>
                ))}
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                  Bedrag
                </th>
              </tr>
            </thead>
            <tbody>
              {recent.map((tx) => (
                <tr
                  key={`${String(tx.date)}-${tx.name}-${String(tx.type)}`}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => onNavigate(tx.section)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      onNavigate(tx.section);
                  }}
                  tabIndex={0}
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
                  <td className="px-4 py-3 font-medium max-w-[140px] truncate">
                    {tx.name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-block px-2 py-0.5 rounded text-xs font-medium",
                        tx.type === TransactionType.buy ||
                          tx.type === LoanTransactionType.repaymentReceived
                          ? "bg-muted text-muted-foreground"
                          : tx.type === TransactionType.sell
                            ? "bg-loss-muted text-loss"
                            : "bg-gain-muted text-gain",
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
  );
}
