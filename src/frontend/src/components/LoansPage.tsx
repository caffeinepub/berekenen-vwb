import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ArrowDownToLine,
  Inbox,
  Percent,
  Plus,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useAllLoans } from "../hooks/useQueries";
import { formatEuro } from "../utils/format";
import { loanOutstanding, loanTotalInterest } from "../utils/loanHelpers";
import { AddLoanDialog } from "./loans/AddLoanDialog";
import { LoanCard } from "./loans/LoanCard";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2">
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

export function LoansPage() {
  const { data: loans = [], isLoading } = useAllLoans();

  const totalLoaned = loans.reduce((s, l) => s + l.loanedAmount, 0);
  const totalOutstanding = loans.reduce((s, l) => s + loanOutstanding(l), 0);
  const totalInterest = loans.reduce((s, l) => s + loanTotalInterest(l), 0);
  const totalReturnPct =
    totalLoaned > 0 ? (totalInterest / totalLoaned) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoading
              ? ""
              : loans.length === 0
                ? "Nog geen leningen"
                : `${loans.length} lening${loans.length !== 1 ? "en" : ""}`}
          </p>
        </div>
        <AddLoanDialog>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" />
            Lening toevoegen
          </Button>
        </AddLoanDialog>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Totaal uitgeleend"
          icon={<Wallet className="w-4 h-4" />}
          value={<span className="num">{formatEuro(totalLoaned)}</span>}
        />
        <StatCard
          label="Totaal uitstaand"
          icon={<ArrowDownToLine className="w-4 h-4" />}
          value={<span className="num">{formatEuro(totalOutstanding)}</span>}
        />
        <StatCard
          label="Ontvangen rente"
          icon={<TrendingUp className="w-4 h-4" />}
          value={
            <span className={cn("num", totalInterest > 0 ? "text-gain" : "")}>
              {totalInterest > 0 ? "+" : ""}
              {formatEuro(totalInterest)}
            </span>
          }
        />
        <StatCard
          label="Gerealiseerd rendement"
          icon={<Percent className="w-4 h-4" />}
          value={
            <div className="flex flex-col gap-0.5">
              <span className={cn("num", totalInterest > 0 ? "text-gain" : "")}>
                {totalInterest > 0 ? "+" : ""}
                {formatEuro(totalInterest)}
              </span>
              <span
                className={cn(
                  "text-xs num",
                  totalReturnPct > 0 ? "text-gain" : "text-muted-foreground",
                )}
              >
                {totalReturnPct > 0 ? "+" : ""}
                {totalReturnPct.toFixed(2).replace(".", ",")}%
              </span>
            </div>
          }
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {["a", "b"].map((k) => (
            <div
              key={k}
              className="bg-card border border-border rounded-lg p-5"
            >
              <Skeleton className="h-5 w-48 mb-3" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      ) : loans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <Inbox className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">
              Geen leningen gevonden
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Voeg je eerste lening toe om bij te houden wat je hebt uitgeleend.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {loans.map((loan) => (
            <LoanCard key={String(loan.id)} loan={loan} />
          ))}
        </div>
      )}
    </div>
  );
}
