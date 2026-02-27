import { TransactionView, TransactionType, AssetType, AssetView } from "../backend.d";
import { formatDate, formatQuantity, formatEuro } from "../utils/format";
import { ReturnValue } from "./MoneyValue";
import { TransactionTypeBadge } from "./AssetBadge";
import { EditTransactionDialog } from "./EditTransactionDialog";
import { ChevronDown, ChevronRight, Inbox, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useDeleteTransaction } from "../hooks/useQueries";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface TransactionHistoryProps {
  asset: AssetView;
  currentPrice: number;
  assetType: AssetType;
  terMap?: Record<string, number>;
  ticker?: string;
  defaultOpen?: boolean;
  isCommodity?: boolean;
}

interface TransactionWithProfit extends TransactionView {
  realizedProfit?: number;
  originalIndex: number;
}

function computeTransactionProfits(
  transactions: TransactionView[],
  currentPrice: number
): TransactionWithProfit[] {
  // Sort by date ascending for FIFO, keeping track of original indices
  const indexed = transactions.map((tx, i) => ({ tx, origIdx: i }));
  const sorted = [...indexed].sort((a, b) => Number(a.tx.date - b.tx.date));

  interface Lot { quantity: number; costPerUnit: number; }
  const lots: Lot[] = [];
  const profitMap = new Map<number, number>(); // origIdx -> profit

  for (const { tx, origIdx } of sorted) {
    if (tx.transactionType === TransactionType.buy) {
      const feesPerUnit = (tx.fees ?? 0) / tx.quantity;
      lots.push({ quantity: tx.quantity, costPerUnit: tx.pricePerUnit + feesPerUnit });
    } else if (tx.transactionType === TransactionType.sell) {
      let remaining = tx.quantity;
      const saleRevenue = tx.pricePerUnit * tx.quantity - (tx.fees ?? 0);
      let costOfSold = 0;

      while (remaining > 0 && lots.length > 0) {
        const lot = lots[0];
        if (lot.quantity <= remaining) {
          costOfSold += lot.quantity * lot.costPerUnit;
          remaining -= lot.quantity;
          lots.shift();
        } else {
          costOfSold += remaining * lot.costPerUnit;
          lot.quantity -= remaining;
          remaining = 0;
        }
      }
      profitMap.set(origIdx, saleRevenue - costOfSold);
    } else if (tx.transactionType === TransactionType.stakingReward) {
      lots.push({ quantity: tx.quantity, costPerUnit: 0 });
      // Euro value at receipt counts as realized profit
      if (tx.euroValue !== undefined) {
        profitMap.set(origIdx, tx.euroValue);
      }
    } else if (tx.transactionType === TransactionType.dividend) {
      // Dividend counts as realized profit
      if (tx.euroValue !== undefined) {
        profitMap.set(origIdx, tx.euroValue);
      }
    }
  }

  // Return in display order (newest first handled by caller) with originalIndex
  return transactions.map((tx, i) => ({
    ...tx,
    realizedProfit: profitMap.get(i),
    originalIndex: i,
  }));
}

interface DeleteTransactionButtonProps {
  ticker: string;
  index: number;
}

function DeleteTransactionButton({ ticker, index }: DeleteTransactionButtonProps) {
  const deleteTransaction = useDeleteTransaction();

  const handleDelete = async () => {
    try {
      await deleteTransaction.mutateAsync({ ticker, index });
      toast.success("Transactie verwijderd");
    } catch {
      toast.error("Fout bij het verwijderen van transactie");
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-loss transition-colors opacity-0 group-hover:opacity-100"
          title="Verwijderen"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Transactie verwijderen?</AlertDialogTitle>
          <AlertDialogDescription>
            Deze actie kan niet ongedaan worden gemaakt. De transactie wordt permanent
            verwijderd uit je portfolio.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Verwijderen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function TransactionHistory({
  asset,
  currentPrice,
  assetType,
  defaultOpen = false,
  isCommodity = false,
}: TransactionHistoryProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isCrypto = assetType === AssetType.crypto;
  const transactions = asset.transactions;

  const txWithProfits = computeTransactionProfits(transactions, currentPrice);
  // Show newest first
  const sorted = [...txWithProfits].sort((a, b) => Number(b.date - a.date));

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <span>{transactions.length} transacties</span>
      </button>

      {open && (
        <div className="mt-2 overflow-x-auto">
          {sorted.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <Inbox className="w-4 h-4" />
              <span>Geen transacties</span>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Datum
                  </th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-right py-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Aantal
                  </th>
                  <th className="text-right py-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Prijs/stuk
                  </th>
                  <th className="text-right py-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                     Kosten
                   </th>
                   <th className="text-right py-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                     Winst/Verlies
                   </th>
                  <th className="w-16 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((tx, idx) => (
                  <tr
                    key={`${tx.date}-${idx}`}
                    className={cn(
                      "border-b border-border/50 last:border-0 group",
                      "hover:bg-accent/30 transition-colors"
                    )}
                  >
                    <td className="py-2.5 pr-4 text-muted-foreground num text-xs">
                      {formatDate(tx.date)}
                    </td>
                    <td className="py-2.5 pr-4">
                      <TransactionTypeBadge type={tx.transactionType} />
                    </td>
                    <td className="py-2.5 pr-4 text-right num">
                      {formatQuantity(tx.quantity, isCrypto)}
                    </td>
                     <td className="py-2.5 pr-4 text-right num">
                       {tx.transactionType === TransactionType.stakingReward ||
                        tx.transactionType === TransactionType.dividend
                         ? <span className="text-muted-foreground">—</span>
                         : formatEuro(tx.pricePerUnit, 6)
                       }
                     </td>
                     <td className="py-2.5 pr-4 text-right num text-muted-foreground">
                       {tx.fees ? formatEuro(tx.fees) : "—"}
                     </td>
                     <td className="py-2.5 pr-4 text-right">
                      {tx.realizedProfit !== undefined ? (
                        <ReturnValue amount={tx.realizedProfit} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <EditTransactionDialog
                          asset={asset}
                          transactionIndex={tx.originalIndex}
                          transaction={transactions[tx.originalIndex]}
                          isCommodity={isCommodity}
                        >
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                            title="Bewerken"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </EditTransactionDialog>
                        <DeleteTransactionButton
                          ticker={asset.ticker}
                          index={tx.originalIndex}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}


