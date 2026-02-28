import { toast } from "sonner";
import { AssetType, TransactionType } from "../backend.d";
import {
  formatDate,
  formatEuro,
  formatPercent,
  formatQuantity,
} from "./format";
import type { YearStats, YearTransaction } from "./yearStats";

function txTypeLabel(type: TransactionType): string {
  switch (type) {
    case TransactionType.buy:
      return "Aankoop";
    case TransactionType.sell:
      return "Verkoop";
    case TransactionType.stakingReward:
      return "Staking reward";
    case TransactionType.dividend:
      return "Dividend";
    default:
      return String(type);
  }
}

export async function exportXlsx(
  year: number,
  stats: YearStats,
  transactions: YearTransaction[],
  commodityTickers?: Set<string>,
) {
  let XLSX: any;
  try {
    XLSX = await import(
      "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs" as unknown as string
    );
  } catch {
    toast.error("Export niet beschikbaar: xlsx kon niet worden geladen");
    return;
  }

  const summaryData = [
    ["Label", "Waarde (€)"],
    ["Inleg", stats.totalInvested],
    ["Verkopen", stats.totalSales],
    ["Transactiekosten", stats.totalFees],
    ["Gerealiseerd", stats.realizedPnL],
    ["Ongerealiseerd", stats.unrealizedPnL],
    ...(stats.totalDividend > 0
      ? [["Ontvangen dividend", stats.totalDividend]]
      : []),
    ...(stats.totalStaking > 0
      ? [["Ontvangen staking", stats.totalStaking]]
      : []),
    ...(stats.txTerCosts > 0
      ? [["Lopende kosten (ETF) – totaal huidige waarde", -stats.txTerCosts]]
      : []),
    ["Netto rendement", stats.netReturn],
    ["Rendement %", stats.netReturnPct / 100],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet["!cols"] = [{ wch: 28 }, { wch: 18 }];

  const pctCell = summarySheet[`B${summaryData.length}`];
  if (pctCell) {
    pctCell.t = "n";
    pctCell.z = "0.00%";
  }

  const txHeaders = [
    "Datum",
    "Asset",
    "Ticker",
    "Type",
    "Sectie",
    "Aantal",
    "Prijs/stuk (€)",
    "Transactiekosten (€)",
    "Winst/Verlies (€)",
  ];
  const txRows = transactions.map((tx) => {
    const isCommodityRow = !!commodityTickers?.has(tx.assetTicker);
    return [
      formatDate(tx.date),
      tx.assetName,
      tx.assetTicker,
      txTypeLabel(tx.transactionType),
      tx.assetType === AssetType.crypto
        ? "Crypto"
        : isCommodityRow
          ? "Grondstof"
          : "Aandeel",
      tx.transactionType === TransactionType.dividend ? "" : tx.quantity,
      tx.transactionType === TransactionType.stakingReward ||
      tx.transactionType === TransactionType.dividend
        ? ""
        : tx.pricePerUnit,
      tx.fees ?? "",
      tx.realizedProfit ?? "",
    ];
  });

  const totalFees = transactions.reduce((s, tx) => s + (tx.fees ?? 0), 0);
  const totalPnL = transactions.reduce(
    (s, tx) => s + (tx.realizedProfit ?? 0),
    0,
  );
  const totaalRow = ["Totaal", "", "", "", "", "", "", totalFees, totalPnL];

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
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summarySheet, "Samenvatting");
  XLSX.utils.book_append_sheet(wb, txSheet, "Transacties");
  XLSX.writeFile(wb, `VWB_Jaaroverzicht_${year}.xlsx`);
}

export async function exportPdf(
  year: number,
  stats: YearStats,
  transactions: YearTransaction[],
  commodityTickers?: Set<string>,
) {
  let jsPDFModule: any;
  let autoTableModule: any;
  try {
    jsPDFModule = await import(
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" as unknown as string
    );
    autoTableModule = await import(
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js" as unknown as string
    );
  } catch {
    toast.error(
      "Export niet beschikbaar: PDF-bibliotheek kon niet worden geladen",
    );
    return;
  }

  const JsPDFCtor =
    jsPDFModule?.jsPDF ?? jsPDFModule?.default?.jsPDF ?? (jsPDFModule as any);
  const autoTable = autoTableModule?.default ?? autoTableModule;

  const doc: any = new JsPDFCtor({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`PortfolioFlow — Jaaroverzicht ${year}`, 14, 18);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Gegenereerd op ${new Date().toLocaleDateString("nl-NL")}`, 14, 24);
  doc.setTextColor(0);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Samenvatting", 14, 32);

  const summaryRows = [
    ["Inleg", formatEuro(stats.totalInvested)],
    ["Verkopen", formatEuro(stats.totalSales)],
    ["Transactiekosten", formatEuro(stats.totalFees)],
    ["Gerealiseerd", formatEuro(stats.realizedPnL)],
    ["Ongerealiseerd", formatEuro(stats.unrealizedPnL)],
    ...(stats.totalDividend > 0
      ? [["Ontvangen dividend", formatEuro(stats.totalDividend)]]
      : []),
    ...(stats.totalStaking > 0
      ? [["Ontvangen staking", formatEuro(stats.totalStaking)]]
      : []),
    ...(stats.txTerCosts > 0
      ? [
          [
            "Lopende kosten (ETF) – totaal huidige waarde",
            `-${formatEuro(stats.txTerCosts)}`,
          ],
        ]
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

  const afterSummary = doc.lastAutoTable?.finalY ?? 80;

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
    "Winst/Verlies",
  ];
  const txRows = transactions.map((tx) => {
    const isCommodityRow = !!commodityTickers?.has(tx.assetTicker);
    return [
      formatDate(tx.date),
      tx.assetName,
      tx.assetTicker,
      txTypeLabel(tx.transactionType),
      tx.assetType === AssetType.crypto
        ? "Crypto"
        : isCommodityRow
          ? "Grondstof"
          : "Aandeel",
      tx.transactionType === TransactionType.dividend
        ? "—"
        : formatQuantity(tx.quantity, tx.assetType === AssetType.crypto),
      tx.transactionType === TransactionType.stakingReward ||
      tx.transactionType === TransactionType.dividend
        ? "—"
        : formatEuro(tx.pricePerUnit, 4),
      tx.fees ? formatEuro(tx.fees) : "—",
      tx.realizedProfit !== undefined ? formatEuro(tx.realizedProfit) : "—",
    ];
  });

  const totalFees = transactions.reduce((s, tx) => s + (tx.fees ?? 0), 0);
  const totalPnL = transactions.reduce(
    (s, tx) => s + (tx.realizedProfit ?? 0),
    0,
  );
  const totaalRow = [
    "Totaal",
    "",
    "",
    "",
    "",
    "",
    "",
    formatEuro(totalFees),
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
    },
    margin: { left: 14, right: 14 },
  });

  doc.save(`VWB_Jaaroverzicht_${year}.pdf`);
}
