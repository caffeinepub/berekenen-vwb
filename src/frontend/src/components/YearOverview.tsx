import { useMemo, useState } from "react";
import { AssetView, TransactionType, AssetType } from "../backend.d";
import { formatEuro, formatDate, formatQuantity, formatPercent } from "../utils/format";
import { MoneyValue, ReturnValue } from "./MoneyValue";
import { TransactionTypeBadge } from "./AssetBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Inbox,
  TrendingUp,
  TrendingDown,
  Wallet,
  BarChart3,
  Receipt,
  Percent,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import autoTable from "jspdf-autotable";
import { jsPDF } from "jspdf";

interface YearOverviewProps {
  assets: AssetView[];
  terMap: Record<string, number>;
}

interface YearStats {
  totalInvested: number;
  totalSales: number;
  totalFees: number;
  realizedPnL: number;
  unrealizedPnL: number;
  terCosts: number;
  txTerCosts: number;
  netReturn: number;
  netReturnPct: number;
}

interface YearTransaction {
  date: bigint;
  assetTicker: string;
  assetName: string;
  assetType: AssetType;
  transactionType: TransactionType;
  quantity: number;
  pricePerUnit: number;
  fees?: number;
  hasOngoingCosts?: boolean;
  realizedProfit?: number;
}

function getQuantityAtEndOfYear(
  transactions: {
    date: bigint;
    transactionType: TransactionType;
    quantity: number;
    hasOngoingCosts?: boolean;
  }[],
  year: number,
  exclusive: boolean = false,
  onlyOngoing: boolean = false
): number {
  const sorted = [...transactions].sort((a, b) => Number(a.date - b.date));
  let qty = 0;
  for (const tx of sorted) {
    const txYear = new Date(Number(tx.date / 1_000_000n)).getFullYear();
    if (exclusive ? txYear < year : txYear <= year) {
      if (onlyOngoing && !tx.hasOngoingCosts) continue;
      if (
        tx.transactionType === TransactionType.buy ||
        tx.transactionType === TransactionType.stakingReward
      ) {
        qty += tx.quantity;
      } else if (tx.transactionType === TransactionType.sell) {
        qty -= tx.quantity;
      }
    }
  }
  return Math.max(0, qty);
}

function computeRealizedForYear(
  transactions: {
    date: bigint;
    transactionType: TransactionType;
    quantity: number;
    pricePerUnit: number;
    fees?: number;
  }[],
  year: number
): { totalRealized: number; txProfits: Map<number, number> } {
  const sorted = [...transactions]
    .map((tx, origIdx) => ({ ...tx, origIdx }))
    .sort((a, b) => Number(a.date - b.date));

  interface Lot {
    quantity: number;
    costPerUnit: number;
  }
  const lots: Lot[] = [];
  const txProfits = new Map<number, number>();
  let totalRealized = 0;

  for (const tx of sorted) {
    const txYear = new Date(Number(tx.date / 1_000_000n)).getFullYear();
    if (txYear > year) break;

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
      const profit = saleRevenue - costOfSold;
      if (txYear === year) {
        totalRealized += profit;
        txProfits.set(tx.origIdx, profit);
      }
    } else if (tx.transactionType === TransactionType.stakingReward) {
      lots.push({ quantity: tx.quantity, costPerUnit: 0 });
    }
  }

  return { totalRealized, txProfits };
}

function computeYearStats(
  assets: AssetView[],
  year: number,
  terMap: Record<string, number>
): YearStats {
  let totalInvested = 0;
  let totalSales = 0;
  let totalFees = 0;
  let realizedPnL = 0;
  let unrealizedPnL = 0;
  let terCosts = 0;
  let txTerCosts = 0;
  let allTimeInvested = 0;

  for (const asset of assets) {
    const txInYear = asset.transactions.filter((tx) => {
      const txYear = new Date(Number(tx.date / 1_000_000n)).getFullYear();
      return txYear === year;
    });

    // Invested, sales, fees this year
    for (const tx of txInYear) {
      if (tx.transactionType === TransactionType.buy) {
        totalInvested += tx.quantity * tx.pricePerUnit + (tx.fees ?? 0);
      } else if (tx.transactionType === TransactionType.sell) {
        totalSales += tx.quantity * tx.pricePerUnit - (tx.fees ?? 0);
      }
      totalFees += tx.fees ?? 0;
    }

    // Realized P&L from FIFO for sells in this year
    const { totalRealized } = computeRealizedForYear(asset.transactions, year);
    realizedPnL += totalRealized;

    // Unrealized P&L: all transactions up to now
    const sorted = [...asset.transactions].sort((a, b) => Number(a.date - b.date));
    interface Lot {
      quantity: number;
      costPerUnit: number;
    }
    const lots: Lot[] = [];
    for (const tx of sorted) {
      if (tx.transactionType === TransactionType.buy) {
        const feesPerUnit = (tx.fees ?? 0) / tx.quantity;
        lots.push({ quantity: tx.quantity, costPerUnit: tx.pricePerUnit + feesPerUnit });
      } else if (tx.transactionType === TransactionType.sell) {
        let remaining = tx.quantity;
        while (remaining > 0 && lots.length > 0) {
          const lot = lots[0];
          if (lot.quantity <= remaining) {
            remaining -= lot.quantity;
            lots.shift();
          } else {
            lot.quantity -= remaining;
            remaining = 0;
          }
        }
      } else if (tx.transactionType === TransactionType.stakingReward) {
        lots.push({ quantity: tx.quantity, costPerUnit: 0 });
      }
    }
    const currentQty = lots.reduce((s, l) => s + l.quantity, 0);
    const costBasis = lots.reduce((s, l) => s + l.quantity * l.costPerUnit, 0);
    unrealizedPnL += currentQty * asset.currentPrice - costBasis;

    // All-time invested for return %
    for (const tx of asset.transactions) {
      if (tx.transactionType === TransactionType.buy) {
        allTimeInvested += tx.quantity * tx.pricePerUnit + (tx.fees ?? 0);
      }
    }

    // TER costs for this year: only count units from transactions with hasOngoingCosts === true
    const ter = terMap[asset.ticker];
    if (ter !== undefined && ter > 0) {
      const startQty = getQuantityAtEndOfYear(asset.transactions, year, true, true);
      const endQty = getQuantityAtEndOfYear(asset.transactions, year, false, true);
      const avgQty = (startQty + endQty) / 2;
      terCosts += avgQty * asset.currentPrice * (ter / 100);
    }

    // Per-transactie TER kosten voor het jaar
    if (asset.assetType !== AssetType.crypto) {
      const txTer = terMap[asset.ticker];
      if (txTer !== undefined && txTer > 0) {
        for (const tx of asset.transactions) {
          if (!tx.hasOngoingCosts) continue;
          const txYear = new Date(Number(tx.date / 1_000_000n)).getFullYear();
          if (txYear === year) {
            txTerCosts += tx.quantity * tx.pricePerUnit * (txTer / 100);
          }
        }
      }
    }
  }

  const netReturn = realizedPnL + unrealizedPnL - terCosts - txTerCosts;
  const netReturnPct = allTimeInvested > 0 ? (netReturn / allTimeInvested) * 100 : 0;

  return {
    totalInvested,
    totalSales,
    totalFees,
    realizedPnL,
    unrealizedPnL,
    terCosts,
    txTerCosts,
    netReturn,
    netReturnPct,
  };
}

function getYearTransactions(assets: AssetView[], year: number): YearTransaction[] {
  const result: YearTransaction[] = [];

  for (const asset of assets) {
    const txInYear = asset.transactions.filter((tx) => {
      const txYear = new Date(Number(tx.date / 1_000_000n)).getFullYear();
      return txYear === year;
    });

    const { txProfits } = computeRealizedForYear(asset.transactions, year);

    const sorted = [...asset.transactions].sort((a, b) => Number(a.date - b.date));
    for (const tx of txInYear) {
      const origIdx = sorted.indexOf(tx);
      result.push({
        date: tx.date,
        assetTicker: asset.ticker,
        assetName: asset.name,
        assetType: asset.assetType,
        transactionType: tx.transactionType,
        quantity: tx.quantity,
        pricePerUnit: tx.pricePerUnit,
        fees: tx.fees,
        hasOngoingCosts: tx.hasOngoingCosts,
        realizedProfit: txProfits.get(origIdx),
      });
    }
  }

  return result.sort((a, b) => Number(b.date - a.date));
}

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  className?: string;
}

function StatCard({ label, value, icon, className }: StatCardProps) {
  return (
    <div className={cn("bg-card border border-border rounded-lg p-4 flex flex-col gap-2", className)}>
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

function txTypeLabel(type: TransactionType): string {
  switch (type) {
    case TransactionType.buy:
      return "Aankoop";
    case TransactionType.sell:
      return "Verkoop";
    case TransactionType.stakingReward:
      return "Staking reward";
    default:
      return String(type);
  }
}

function calcTxTerCost(tx: YearTransaction, terMap: Record<string, number>): number {
  if (tx.assetType === AssetType.crypto) return 0;
  if (!tx.hasOngoingCosts) return 0;
  const ter = terMap[tx.assetTicker];
  if (!ter || ter <= 0) return 0;
  return tx.quantity * tx.pricePerUnit * (ter / 100);
}

function exportXlsx(
  year: number,
  stats: YearStats,
  transactions: YearTransaction[],
  terMap: Record<string, number>
) {
  const hasTer = Object.values(terMap).some((v) => v > 0);

  // Sheet 1: Samenvatting
  const summaryData = [
    ["Label", "Waarde (€)"],
    ["Geïnvesteerd", stats.totalInvested],
    ["Verkopen", stats.totalSales],
    ["Transactiekosten", stats.totalFees],
    ["Gerealiseerd", stats.realizedPnL],
    ["Ongerealiseerd", stats.unrealizedPnL],
    ...(hasTer ? [["Lopende kosten ETF", -stats.terCosts]] : []),
    ...(stats.txTerCosts > 0 ? [["Lop. kosten (transacties)", -stats.txTerCosts]] : []),
    ["Netto rendement", stats.netReturn],
    ["Rendement %", stats.netReturnPct / 100],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet["!cols"] = [{ wch: 28 }, { wch: 18 }];

  // Format rendement % as percentage
  const pctCell = summarySheet[`B${summaryData.length}`];
  if (pctCell) {
    pctCell.t = "n";
    pctCell.z = "0.00%";
  }

  // Sheet 2: Transacties
  const txHeaders = [
    "Datum",
    "Asset",
    "Ticker",
    "Type",
    "Sectie",
    "Aantal",
    "Prijs/stuk (€)",
    "Transactiekosten (€)",
    "Lop. kosten (€)",
    "Winst/Verlies (€)",
  ];
  const txRows = transactions.map((tx) => {
    const txTer = calcTxTerCost(tx, terMap);
    return [
      formatDate(tx.date),
      tx.assetName,
      tx.assetTicker,
      txTypeLabel(tx.transactionType),
      tx.assetType === AssetType.crypto ? "Crypto" : "Aandeel",
      tx.quantity,
      tx.transactionType === TransactionType.stakingReward ? "" : tx.pricePerUnit,
      tx.fees ?? "",
      txTer > 0 ? -txTer : "",
      tx.realizedProfit ?? "",
    ];
  });

  // Totaal row
  const totalFees = transactions.reduce((s, tx) => s + (tx.fees ?? 0), 0);
  const totalTxTer = transactions.reduce((s, tx) => s + calcTxTerCost(tx, terMap), 0);
  const totalPnL = transactions.reduce((s, tx) => s + (tx.realizedProfit ?? 0), 0);
  const totaalRow = [
    "Totaal", "", "", "", "", "", "",
    totalFees,
    totalTxTer > 0 ? -totalTxTer : "",
    totalPnL,
  ];

  const txSheet = XLSX.utils.aoa_to_sheet([txHeaders, ...txRows, totaalRow]);
  txSheet["!cols"] = [
    { wch: 12 },
    { wch: 24 },
    { wch: 10 },
    { wch: 16 },
    { wch: 10 },
    { wch: 12 },
    { wch: 16 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summarySheet, "Samenvatting");
  XLSX.utils.book_append_sheet(wb, txSheet, "Transacties");
  XLSX.writeFile(wb, `VWB_Jaaroverzicht_${year}.xlsx`);
}

function exportPdf(
  year: number,
  stats: YearStats,
  transactions: YearTransaction[],
  terMap: Record<string, number>
) {
  const hasTer = Object.values(terMap).some((v) => v > 0);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`Berekenen VWB — Jaaroverzicht ${year}`, 14, 18);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Gegenereerd op ${new Date().toLocaleDateString("nl-NL")}`, 14, 24);
  doc.setTextColor(0);

  // Summary table
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Samenvatting", 14, 32);

  const summaryRows: [string, string][] = [
    ["Geïnvesteerd", formatEuro(stats.totalInvested)],
    ["Verkopen", formatEuro(stats.totalSales)],
    ["Transactiekosten", formatEuro(stats.totalFees)],
    ["Gerealiseerd", formatEuro(stats.realizedPnL)],
    ["Ongerealiseerd", formatEuro(stats.unrealizedPnL)],
    ...(hasTer
      ? [["Lopende kosten ETF", `-${formatEuro(stats.terCosts)}`] as [string, string]]
      : []),
    ...(stats.txTerCosts > 0
      ? [["Lop. kosten (transacties)", `-${formatEuro(stats.txTerCosts)}`] as [string, string]]
      : []),
    ["Netto rendement", formatEuro(stats.netReturn)],
    ["Rendement %", formatPercent(stats.netReturnPct)],
  ];

  autoTable(doc, {
    startY: 36,
    head: [["Omschrijving", "Bedrag"]],
    body: summaryRows,
    theme: "striped",
    headStyles: { fillColor: [30, 30, 30], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: 14, right: 14 },
    tableWidth: 100,
  });

  // Transactions table
  const afterSummary = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
    ?.finalY ?? 80;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Transacties", 14, afterSummary + 10);

  const txHeaders = [
    "Datum",
    "Asset",
    "Ticker",
    "Type",
    "Sectie",
    "Aantal",
    "Prijs/stuk",
    "Tx kosten",
    "Lop. kosten",
    "Winst/Verlies",
  ];
  const txRows = transactions.map((tx) => {
    const txTer = calcTxTerCost(tx, terMap);
    return [
      formatDate(tx.date),
      tx.assetName,
      tx.assetTicker,
      txTypeLabel(tx.transactionType),
      tx.assetType === AssetType.crypto ? "Crypto" : "Aandeel",
      formatQuantity(tx.quantity, tx.assetType === AssetType.crypto),
      tx.transactionType === TransactionType.stakingReward ? "—" : formatEuro(tx.pricePerUnit, 4),
      tx.fees ? formatEuro(tx.fees) : "—",
      txTer > 0 ? `-${formatEuro(txTer)}` : "—",
      tx.realizedProfit !== undefined ? formatEuro(tx.realizedProfit) : "—",
    ];
  });

  // Totaal row
  const totalFees = transactions.reduce((s, tx) => s + (tx.fees ?? 0), 0);
  const totalTxTer = transactions.reduce((s, tx) => s + calcTxTerCost(tx, terMap), 0);
  const totalPnL = transactions.reduce((s, tx) => s + (tx.realizedProfit ?? 0), 0);
  const totaalRow = [
    "Totaal", "", "", "", "", "", "",
    formatEuro(totalFees),
    totalTxTer > 0 ? `-${formatEuro(totalTxTer)}` : "—",
    formatEuro(totalPnL),
  ];

  autoTable(doc, {
    startY: afterSummary + 14,
    head: [txHeaders],
    body: [...txRows, totaalRow],
    theme: "striped",
    headStyles: { fillColor: [30, 30, 30], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  doc.save(`VWB_Jaaroverzicht_${year}.pdf`);
}

export function YearOverview({ assets, terMap }: YearOverviewProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2019 }, (_, i) => currentYear - i);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const stats = useMemo(
    () => computeYearStats(assets, selectedYear, terMap),
    [assets, selectedYear, terMap]
  );

  const yearTxs = useMemo(
    () => getYearTransactions(assets, selectedYear),
    [assets, selectedYear]
  );

  const hasTer = Object.values(terMap).some((v) => v > 0);
  const hasTxTerCosts = stats.txTerCosts > 0;
  const returnIsPositive = stats.netReturn > 0.005;
  const returnIsNegative = stats.netReturn < -0.005;

  return (
    <section aria-labelledby="year-overview-heading" className="flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <h3 id="year-overview-heading" className="text-base font-semibold tracking-tight">
            Overzicht
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Export buttons */}
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={() => exportXlsx(selectedYear, stats, yearTxs, terMap)}
            title="Exporteren als Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            XLSX
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={() => exportPdf(selectedYear, stats, yearTxs, terMap)}
            title="Exporteren als PDF"
          >
            <FileText className="w-3.5 h-3.5" />
            PDF
          </Button>
          {/* Year selector */}
          <Select
            value={String(selectedYear)}
            onValueChange={(v) => setSelectedYear(Number(v))}
          >
            <SelectTrigger className="w-28 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard
          label="Geïnvesteerd"
          icon={<Wallet className="w-4 h-4" />}
          value={<MoneyValue amount={stats.totalInvested} className="text-lg font-semibold" />}
        />
        <StatCard
          label="Verkopen"
          icon={<BarChart3 className="w-4 h-4" />}
          value={<MoneyValue amount={stats.totalSales} className="text-lg font-semibold" />}
        />
        <StatCard
          label="Transactiekosten"
          icon={<Receipt className="w-4 h-4" />}
          value={<MoneyValue amount={stats.totalFees} className="text-lg font-semibold" />}
        />
        <StatCard
          label="Gerealiseerd"
          icon={<TrendingUp className="w-4 h-4" />}
          value={<ReturnValue amount={stats.realizedPnL} className="text-lg font-semibold" />}
        />
        <StatCard
          label="Ongerealiseerd"
          icon={<TrendingUp className="w-4 h-4" />}
          value={<ReturnValue amount={stats.unrealizedPnL} className="text-lg font-semibold" />}
        />
        {hasTer && (
          <StatCard
            label="Lopende kosten ETF"
            icon={<Percent className="w-4 h-4" />}
            value={
              <span className="num text-lg font-semibold text-loss">
                {stats.terCosts > 0 ? `-${formatEuro(stats.terCosts)}` : formatEuro(0)}
              </span>
            }
          />
        )}
        {hasTxTerCosts && (
          <StatCard
            label="Lop. kosten (transacties)"
            icon={<Percent className="w-4 h-4" />}
            value={
              <span className="num text-lg font-semibold text-loss">
                -{formatEuro(stats.txTerCosts)}
              </span>
            }
          />
        )}
        <StatCard
          label="Netto rendement"
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
              <ReturnValue amount={stats.netReturn} className="text-lg font-semibold" />
              <span
                className={cn(
                  "text-xs num",
                  returnIsPositive
                    ? "text-gain"
                    : returnIsNegative
                      ? "text-loss"
                      : "text-muted-foreground"
                )}
              >
                {formatPercent(stats.netReturnPct)}
              </span>
            </div>
          }
          className={cn(
            returnIsPositive && "border-gain/30",
            returnIsNegative && "border-loss/30"
          )}
        />
      </div>

      {/* Transactions table */}
      {yearTxs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center bg-card border border-border rounded-lg">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Inbox className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">Geen transacties in {selectedYear}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Er zijn geen transacties gevonden voor dit jaar.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-medium">
              Transacties {selectedYear}{" "}
              <span className="text-muted-foreground font-normal">({yearTxs.length})</span>
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider">Datum</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Asset</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Sectie</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Type</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-right">
                    Aantal
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-right">
                    Prijs/stuk
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-right">
                    Kosten
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-right">
                    Lop. kosten
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-right">
                    Winst/Verlies
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {yearTxs.map((tx, idx) => {
                  const isCrypto = tx.assetType === AssetType.crypto;
                  return (
                    <TableRow
                      key={`${tx.date}-${tx.assetTicker}-${idx}`}
                      className="hover:bg-accent/30"
                    >
                      <TableCell className="num text-xs text-muted-foreground py-2.5">
                        {formatDate(tx.date)}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-xs">
                            {tx.assetTicker}
                          </span>
                          <span className="text-muted-foreground text-xs hidden sm:inline">
                            {tx.assetName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0",
                            isCrypto
                              ? "border-chart-2/50 text-chart-2"
                              : "border-primary/50 text-primary"
                          )}
                        >
                          {isCrypto ? "Crypto" : "Aandeel"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <TransactionTypeBadge type={tx.transactionType} />
                      </TableCell>
                      <TableCell className="num text-right py-2.5">
                        {formatQuantity(tx.quantity, isCrypto)}
                      </TableCell>
                      <TableCell className="num text-right py-2.5">
                        {tx.transactionType === TransactionType.stakingReward ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          formatEuro(tx.pricePerUnit, 4)
                        )}
                      </TableCell>
                      <TableCell className="num text-right py-2.5 text-muted-foreground">
                        {tx.fees ? formatEuro(tx.fees) : "—"}
                      </TableCell>
                      <TableCell className="num text-right py-2.5">
                        {(() => {
                          const txTer = calcTxTerCost(tx, terMap);
                          if (txTer > 0) {
                            return <ReturnValue amount={-txTer} />;
                          }
                          return <span className="text-muted-foreground">—</span>;
                        })()}
                      </TableCell>
                      <TableCell className="text-right py-2.5">
                        {tx.realizedProfit !== undefined ? (
                          <ReturnValue amount={tx.realizedProfit} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* Totaal row */}
                {(() => {
                  const totalFees = yearTxs.reduce((s, tx) => s + (tx.fees ?? 0), 0);
                  const totalTxTer = yearTxs.reduce((s, tx) => s + calcTxTerCost(tx, terMap), 0);
                  const totalPnL = yearTxs.reduce((s, tx) => s + (tx.realizedProfit ?? 0), 0);
                  return (
                    <TableRow className="bg-muted/50 font-semibold border-t border-border">
                      <TableCell className="py-2.5 text-xs font-semibold">Totaal</TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell />
                      <TableCell />
                      <TableCell />
                      <TableCell className="num text-right py-2.5">
                        {totalFees > 0 ? formatEuro(totalFees) : "—"}
                      </TableCell>
                      <TableCell className="num text-right py-2.5">
                        {totalTxTer > 0 ? <ReturnValue amount={-totalTxTer} /> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right py-2.5">
                        <ReturnValue amount={totalPnL} />
                      </TableCell>
                    </TableRow>
                  );
                })()}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </section>
  );
}
