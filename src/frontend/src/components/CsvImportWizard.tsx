import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { type AssetView, TransactionType } from "../backend.d";
import {
  type FieldName,
  useCSVImportMappings,
} from "../hooks/useCsvImportMappings";
import { useAddTransaction } from "../hooks/useQueries";
import {
  type ParsedCsv,
  decodeFileBuffer,
  getUniqueValues,
  parseCsv,
} from "../utils/csvParser";
import { dateToBigintNano, formatDate, formatEuro } from "../utils/format";

// ─── Constants ──────────────────────────────────────────────────────────────

const KNOWN_NAME_COLUMNS = new Set([
  "naam",
  "name",
  "asset",
  "product",
  "fonds",
  "fund",
  "ticker",
  "symbol",
  "instrument",
  "security",
  "omschrijving",
  "description",
  "coin",
  "currency",
  "token",
  "waardepapier",
]);

const FIELD_AUTO_DETECT: Record<FieldName, string[]> = {
  type: [
    "type",
    "soort",
    "omschrijving",
    "transactietype",
    "order type",
    "action",
    "operation",
    "transaction type",
    "beschrijving",
  ],
  datum: [
    "datum",
    "date",
    "tijd",
    "time",
    "transactiedatum",
    "trade date",
    "settlement date",
    "utc_time",
    "timestamp",
  ],
  aantal: [
    "aantal",
    "aantal stuks",
    "quantity",
    "shares",
    "units",
    "hoeveelheid",
    "no. of shares",
    "change",
    "size",
    "volume",
  ],
  prijs: [
    "koers",
    "prijs",
    "price",
    "prijs per stuk",
    "price per share",
    "koers per stuk",
    "rate",
    "open rate",
    "spot price",
  ],
  kosten: [
    "kosten",
    "transactiekosten",
    "costs",
    "fee",
    "fees",
    "commission",
    "provisie",
    "brokerage",
    "charges",
  ],
  // dividendBedrag is handled separately — no auto-detect patterns
  dividendBedrag: [],
};

const TYPE_AUTO_STOCK: Record<string, string> = {
  buy: "buy",
  BUY: "buy",
  koop: "buy",
  aankoop: "buy",
  aan: "buy",
  k: "buy",
  purchase: "buy",
  "market buy": "buy",
  "effecten koop": "buy",
  "limit buy": "buy",
  "order koop": "buy",
  gekocht: "buy",
  sell: "sell",
  SELL: "sell",
  verkoop: "sell",
  v: "sell",
  sale: "sell",
  "market sell": "sell",
  "effecten verkoop": "sell",
  "limit sell": "sell",
  "order verkoop": "sell",
  verkocht: "sell",
  dividend: "dividend",
  div: "dividend",
  dividenduitkering: "dividend",
  "cash dividend": "dividend",
  "dividend ontvangen": "dividend",
  uitkering: "dividend",
  ter: "ongoingCosts",
  "lopende kosten": "ongoingCosts",
  fondskosten: "ongoingCosts",
  "ongoing charges": "ongoingCosts",
  "management fee": "ongoingCosts",
  beheerkosten: "ongoingCosts",
};

const TYPE_AUTO_CRYPTO: Record<string, string> = {
  buy: "buy",
  BUY: "buy",
  koop: "buy",
  aankoop: "buy",
  purchase: "buy",
  "market buy": "buy",
  sell: "sell",
  SELL: "sell",
  verkoop: "sell",
  sale: "sell",
  "market sell": "sell",
  staking: "stakingReward",
  "staking reward": "stakingReward",
  reward: "stakingReward",
  earn: "stakingReward",
  "coinbase earn": "stakingReward",
  yield: "stakingReward",
  "interest crypto": "stakingReward",
};

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  buy: "Aankoop",
  sell: "Verkoop",
  dividend: "Dividend",
  ongoingCosts: "Lopende kosten",
  stakingReward: "Staking reward",
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface CsvImportWizardProps {
  assetType: "stock" | "crypto";
  assets: AssetView[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Helper: parse a numeric string (replace comma with dot) ─────────────────

function parseNum(s: string): number {
  if (!s || s.trim() === "") return 0;
  const cleaned = s.replace(",", ".").replace(/\s/g, "");
  const num = Number.parseFloat(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

// ─── Helper: parse date string to Date ───────────────────────────────────────

function parseDateStr(s: string): Date | null {
  if (!s || s.trim() === "") return null;
  // Try ISO format first
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  // Try DD-MM-YYYY or DD/MM/YYYY
  const match = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  return null;
}

// ─── Helper: format date for display in preview ──────────────────────────────

function formatPreviewDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEP_NAMES = [
  "CSV uploaden",
  "Naamkolom selecteren",
  "Asset koppelen",
  "Velden mappen",
  "Type vertalen",
  "Controleren en importeren",
];

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
      <span className="font-semibold text-foreground">
        Stap {current} van {total}
      </span>
      <span>—</span>
      <span>{STEP_NAMES[current - 1]}</span>
    </div>
  );
}

// ─── Main wizard component ───────────────────────────────────────────────────

export function CsvImportWizard({
  assetType,
  assets,
  open,
  onOpenChange,
}: CsvImportWizardProps) {
  const {
    nameColumns: savedNameColumns,
    assetMappings: savedAssetMappings,
    fieldMappings: savedFieldMappings,
    typeTranslations: savedTypeTranslations,
    saveNameColumn,
    saveAssetMapping,
    saveFieldMapping,
    saveTypeTranslation,
  } = useCSVImportMappings();

  const addTransaction = useAddTransaction();

  // ─── Wizard state ─────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [parsedCsv, setParsedCsv] = useState<ParsedCsv | null>(null);
  const [fileName, setFileName] = useState("");

  // Step 2: name column
  const [nameColumn, setNameColumn] = useState<string>("");
  const [nameColumnConfirmed, setNameColumnConfirmed] = useState(false);
  const [nameColumnAuto, setNameColumnAuto] = useState(false);

  // Step 3: asset mapping (csvValue → ticker)
  const [assetMappingState, setAssetMappingState] = useState<
    Record<string, string>
  >({});
  const [assetSearchTerms, setAssetSearchTerms] = useState<
    Record<string, string>
  >({});

  // Step 4: field mappings (field → csv column)
  const [fieldMappingState, setFieldMappingState] = useState<
    Record<FieldName, string>
  >({
    type: "",
    datum: "",
    aantal: "",
    prijs: "",
    kosten: "",
    dividendBedrag: "",
  });

  // Step 4: prijs type toggle
  const [prijsType, setPrijsType] = useState<"perStuk" | "totaal">("perStuk");

  // Step 5: type translations (csvValue → transactionType)
  const [typeTranslationState, setTypeTranslationState] = useState<
    Record<string, string>
  >({});

  // Step 6: import state
  const [isImporting, setIsImporting] = useState(false);
  const [editableRows, setEditableRows] = useState<EditableImportRow[]>([]);
  const [duplicatesExpanded, setDuplicatesExpanded] = useState(false);
  const [invalidRowsExpanded, setInvalidRowsExpanded] = useState(false);
  const [importErrorDetails, setImportErrorDetails] = useState<
    { ticker: string; dateStr: string; message: string }[]
  >([]);
  const [importErrorsExpanded, setImportErrorsExpanded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLButtonElement>(null);

  // ─── Auto-detect helpers ─────────────────────────────────────────────────

  const autoDetectNameColumn = useCallback(
    (headers: string[]): string | null => {
      for (const h of headers) {
        const lower = h.toLowerCase().trim();
        if (KNOWN_NAME_COLUMNS.has(lower)) return h;
        // Also check saved name columns
        if (savedNameColumns[lower]) return h;
      }
      return null;
    },
    [savedNameColumns],
  );

  const autoDetectFields = useCallback(
    (headers: string[]): Record<FieldName, string> => {
      const result: Record<FieldName, string> = {
        type: "",
        datum: "",
        aantal: "",
        prijs: "",
        kosten: "",
        dividendBedrag: "",
      };
      const fields: FieldName[] = [
        "type",
        "datum",
        "aantal",
        "prijs",
        "kosten",
      ];

      for (const field of fields) {
        // Check saved mappings first
        const savedCol = savedFieldMappings[field];
        if (savedCol && headers.includes(savedCol)) {
          result[field] = savedCol;
          continue;
        }
        // Auto-detect from known patterns
        const patterns = FIELD_AUTO_DETECT[field];
        for (const h of headers) {
          const lower = h.toLowerCase().trim();
          if (patterns.includes(lower)) {
            result[field] = h;
            break;
          }
        }
      }

      // dividendBedrag: default to saved mapping or same column as prijs
      const savedDividendCol = savedFieldMappings.dividendBedrag;
      if (savedDividendCol && headers.includes(savedDividendCol)) {
        result.dividendBedrag = savedDividendCol;
      } else {
        // Default: same as prijs column (empty string = use prijs)
        result.dividendBedrag = "";
      }

      return result;
    },
    [savedFieldMappings],
  );

  const autoDetectTypes = useCallback(
    (typeValues: string[]): Record<string, string> => {
      const lookup =
        assetType === "crypto" ? TYPE_AUTO_CRYPTO : TYPE_AUTO_STOCK;
      const result: Record<string, string> = {};
      for (const val of typeValues) {
        // Check saved translations first
        if (savedTypeTranslations[val]) {
          result[val] = savedTypeTranslations[val];
          continue;
        }
        // Auto-detect
        const lower = val.toLowerCase().trim();
        if (lookup[lower]) {
          result[val] = lookup[lower];
        } else if (lookup[val]) {
          result[val] = lookup[val];
        }
      }
      return result;
    },
    [assetType, savedTypeTranslations],
  );

  // ─── File handling ────────────────────────────────────────────────────────

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".csv")) {
        toast.error("Selecteer een CSV-bestand (.csv)");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        // Decode with automatic encoding detection (UTF-8 BOM, UTF-8, Windows-1252)
        const text = decodeFileBuffer(buffer);
        const parsed = parseCsv(text);
        if (parsed.headers.length === 0) {
          toast.error("Het bestand bevat geen kolomkoppen");
          return;
        }
        setParsedCsv(parsed);
        setFileName(file.name);

        // Auto-detect name column
        const detected = autoDetectNameColumn(parsed.headers);
        if (detected) {
          setNameColumn(detected);
          setNameColumnAuto(true);
          setNameColumnConfirmed(false);
        } else {
          setNameColumn(parsed.headers[0] ?? "");
          setNameColumnAuto(false);
          setNameColumnConfirmed(false);
        }

        // Auto-detect field mappings
        const fields = autoDetectFields(parsed.headers);
        setFieldMappingState(fields);

        // Move to step 2
        setStep(2);
      };
      reader.readAsArrayBuffer(file);
    },
    [autoDetectNameColumn, autoDetectFields],
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
  };

  // ─── Step navigation ──────────────────────────────────────────────────────

  const goToStep3 = () => {
    if (!parsedCsv || !nameColumn) return;
    // Save name column
    saveNameColumn(nameColumn);

    // Init asset mapping state from saved + auto-detect by exact match
    const uniqueNames = getUniqueValues(parsedCsv.rows, nameColumn);
    const initMapping: Record<string, string> = {};
    const initSearch: Record<string, string> = {};
    for (const name of uniqueNames) {
      const savedTicker = savedAssetMappings[name] ?? "";
      initMapping[name] = savedTicker;
      // If saved, pre-fill search with ticker; if not, pre-fill with the CSV name
      if (savedTicker) {
        const matchedAsset = assets.find((a) => a.ticker === savedTicker);
        initSearch[name] = matchedAsset
          ? `${matchedAsset.ticker} ${matchedAsset.name}`
          : savedTicker;
      } else {
        // Try auto-match by name or ticker
        const lower = name.toLowerCase();
        const autoMatch = assets.find(
          (a) =>
            a.name.toLowerCase() === lower || a.ticker.toLowerCase() === lower,
        );
        if (autoMatch) {
          initMapping[name] = autoMatch.ticker;
          initSearch[name] = `${autoMatch.ticker} ${autoMatch.name}`;
        } else {
          initSearch[name] = "";
        }
      }
    }
    setAssetMappingState(initMapping);
    setAssetSearchTerms(initSearch);
    setStep(3);
  };

  const goToStep4 = () => {
    // Save all asset mappings
    for (const [csvVal, ticker] of Object.entries(assetMappingState)) {
      if (ticker) saveAssetMapping(csvVal, ticker);
    }
    setStep(4);
  };

  const goToStep5 = () => {
    // Save all field mappings (including dividendBedrag)
    for (const [field, col] of Object.entries(fieldMappingState)) {
      if (col) saveFieldMapping(field as FieldName, col);
    }
    // Also save dividendBedrag even if empty (so it overrides stale saved value)
    saveFieldMapping("dividendBedrag", fieldMappingState.dividendBedrag);

    // Init type translations from the type column
    if (parsedCsv && fieldMappingState.type) {
      const typeValues = getUniqueValues(
        parsedCsv.rows,
        fieldMappingState.type,
      );
      const autoTranslations = autoDetectTypes(typeValues);
      setTypeTranslationState(autoTranslations);
    }
    setStep(5);
  };

  const goToStep6 = () => {
    // Save all type translations
    for (const [csvVal, txType] of Object.entries(typeTranslationState)) {
      if (txType) saveTypeTranslation(csvVal, txType);
    }
    // Build editable rows from the parsed import rows
    const rows = buildImportRows();
    setEditableRows(
      rows.map((row, idx) => ({
        ...row,
        id: idx,
        deleted: false,
        dateStr: row.date
          ? row.date.toLocaleDateString("nl-NL", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })
          : "",
      })),
    );
    setDuplicatesExpanded(false);
    setStep(6);
  };

  // ─── Build import rows ────────────────────────────────────────────────────

  interface ImportRow {
    date: Date | null;
    ticker: string;
    assetName: string;
    csvName: string;
    transactionType: string;
    quantity: number;
    pricePerUnit: number;
    fees: number;
    euroValue: number;
    isDuplicate: boolean;
    isValid: boolean;
    errorReason?: string;
  }

  interface EditableImportRow extends ImportRow {
    id: number;
    deleted: boolean;
    dateStr: string;
  }

  const buildImportRows = (): ImportRow[] => {
    if (!parsedCsv) return [];

    const rows: ImportRow[] = [];
    for (const row of parsedCsv.rows) {
      const csvName = nameColumn ? (row[nameColumn] ?? "") : "";
      const ticker = assetMappingState[csvName] ?? "";

      if (!ticker) continue; // skip unmapped assets

      const asset = assets.find((a) => a.ticker === ticker);

      const dateStr = fieldMappingState.datum
        ? (row[fieldMappingState.datum] ?? "")
        : "";
      const date = parseDateStr(dateStr);

      const csvTypeVal = fieldMappingState.type
        ? (row[fieldMappingState.type] ?? "")
        : "";
      const transactionType = typeTranslationState[csvTypeVal] ?? "";

      if (!transactionType) continue; // skip unmapped types

      const quantity = parseNum(
        fieldMappingState.aantal ? (row[fieldMappingState.aantal] ?? "") : "",
      );
      const rawPrice = parseNum(
        fieldMappingState.prijs ? (row[fieldMappingState.prijs] ?? "") : "",
      );
      const pricePerUnit =
        prijsType === "totaal"
          ? quantity > 0
            ? rawPrice / quantity
            : 0
          : rawPrice;
      const fees = parseNum(
        fieldMappingState.kosten ? (row[fieldMappingState.kosten] ?? "") : "",
      );

      // Euro value for dividend / staking / ongoingCosts
      let euroValue = 0;
      if (
        transactionType === "dividend" ||
        transactionType === "ongoingCosts" ||
        transactionType === "stakingReward"
      ) {
        if (
          transactionType === "dividend" &&
          fieldMappingState.dividendBedrag
        ) {
          // Use the dedicated dividend column
          const rawDividend = parseNum(
            row[fieldMappingState.dividendBedrag] ?? "",
          );
          euroValue = rawDividend;
        } else if (transactionType === "dividend") {
          // For dividend: use rawPrice directly as the received amount
          // If prijsType === "totaal", rawPrice is already the total received amount
          // If prijsType === "stuk", multiply by quantity if available
          if (prijsType === "totaal") {
            euroValue = rawPrice;
          } else if (pricePerUnit > 0 && quantity > 0) {
            euroValue = pricePerUnit * quantity;
          } else {
            euroValue = pricePerUnit;
          }
        } else {
          // staking / ongoingCosts: use price × quantity if available, otherwise use price as direct euro value
          if (pricePerUnit > 0 && quantity > 0) {
            euroValue = pricePerUnit * quantity;
          } else if (pricePerUnit > 0) {
            euroValue = pricePerUnit;
          }
        }
      }

      // Validate
      let isValid = true;
      let errorReason: string | undefined;
      if (!date) {
        isValid = false;
        errorReason = `Ongeldige datum: '${dateStr}'`;
      } else if (!transactionType) {
        isValid = false;
        errorReason = `Type niet herkend: '${csvTypeVal}'`;
      }

      // Duplicate detection: same date (day precision) + same ticker + same quantity (or euroValue for dividend/staking)
      let isDuplicate = false;
      if (asset && date) {
        const dayMs = Math.floor(date.getTime() / 86400000);
        isDuplicate = asset.transactions.some((tx) => {
          const txDayMs = Math.floor(Number(tx.date / 1_000_000n) / 86400000);
          if (txDayMs !== dayMs) return false;
          if (
            transactionType === "dividend" ||
            transactionType === "stakingReward" ||
            transactionType === "ongoingCosts"
          ) {
            return Math.abs((tx.euroValue ?? 0) - euroValue) < 0.01;
          }
          return Math.abs(tx.quantity - quantity) < 0.000001;
        });
      }

      rows.push({
        date,
        ticker,
        assetName: asset?.name ?? ticker,
        csvName,
        transactionType,
        quantity,
        pricePerUnit,
        fees,
        euroValue,
        isDuplicate,
        isValid,
        errorReason,
      });
    }
    return rows;
  };

  // ─── Editable row helpers ─────────────────────────────────────────────────

  const updateEditableRow = (
    id: number,
    updates: Partial<EditableImportRow>,
  ) => {
    setEditableRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    );
  };

  const deleteEditableRow = (id: number) => {
    setEditableRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, deleted: true } : r)),
    );
  };

  // ─── Import execution ─────────────────────────────────────────────────────

  const handleImport = async () => {
    const toImport = editableRows.filter(
      (r) => !r.deleted && r.isValid && !r.isDuplicate,
    );

    if (toImport.length === 0) {
      toast.info("Geen nieuwe transacties om te importeren");
      return;
    }

    setIsImporting(true);
    setImportErrorDetails([]);
    let importedCount = 0;
    let errorCount = 0;
    const errorDetails: { ticker: string; dateStr: string; message: string }[] =
      [];

    for (const row of toImport) {
      if (!row.date) continue;
      try {
        const dateBigint = dateToBigintNano(row.date);
        const txType = row.transactionType as keyof typeof TransactionType;
        const isDividendLike =
          txType === "dividend" ||
          txType === "stakingReward" ||
          txType === "ongoingCosts";

        await addTransaction.mutateAsync({
          asset: row.ticker,
          transactionType: TransactionType[txType],
          date: dateBigint,
          quantity: isDividendLike ? 0 : row.quantity,
          pricePerUnit: isDividendLike ? 0 : row.pricePerUnit,
          fees: isDividendLike
            ? undefined
            : row.fees > 0
              ? row.fees
              : undefined,
          euroValue: isDividendLike ? row.euroValue : undefined,
        });
        importedCount++;
      } catch (e: unknown) {
        errorCount++;
        const msg = e instanceof Error ? e.message : String(e);
        errorDetails.push({
          ticker: row.ticker,
          dateStr: row.dateStr ?? formatPreviewDate(row.date),
          message: msg,
        });
      }
    }

    setIsImporting(false);

    const skippedCount = editableRows.filter(
      (r) => !r.deleted && r.isDuplicate,
    ).length;

    if (errorCount > 0) {
      setImportErrorDetails(errorDetails);
      setImportErrorsExpanded(true);
      toast.error(
        `${importedCount} geïmporteerd, ${skippedCount} overgeslagen, ${errorCount} mislukt`,
      );
    } else {
      toast.success(
        `${importedCount} transacties geïmporteerd, ${skippedCount} overgeslagen`,
      );
      onOpenChange(false);
      resetWizard();
    }
  };

  // ─── Reset ────────────────────────────────────────────────────────────────

  const resetWizard = () => {
    setStep(1);
    setParsedCsv(null);
    setFileName("");
    setNameColumn("");
    setNameColumnConfirmed(false);
    setNameColumnAuto(false);
    setAssetMappingState({});
    setAssetSearchTerms({});
    setFieldMappingState({
      type: "",
      datum: "",
      aantal: "",
      prijs: "",
      kosten: "",
      dividendBedrag: "",
    });
    setPrijsType("perStuk");
    setTypeTranslationState({});
    setEditableRows([]);
    setDuplicatesExpanded(false);
    setInvalidRowsExpanded(false);
    setImportErrorDetails([]);
    setImportErrorsExpanded(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) resetWizard();
    onOpenChange(v);
  };

  // ─── Step content ─────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        ref={dropRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed border-border rounded-lg p-12",
          "flex flex-col items-center justify-center gap-4",
          "cursor-pointer hover:border-primary hover:bg-accent/30 transition-colors",
          "min-h-[200px] w-full",
        )}
        data-ocid="csv.dropzone"
      >
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Upload className="w-6 h-6 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">
            Sleep een CSV-bestand hierheen of klik om te bladeren
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Ondersteunde formaten: .csv
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          data-ocid="csv.upload_button"
        >
          Bestand kiezen
        </Button>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileInput}
      />
    </div>
  );

  const renderStep2 = () => {
    if (!parsedCsv) return null;
    const headers = parsedCsv.headers;

    return (
      <div className="flex flex-col gap-6">
        {/* File info */}
        <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-lg border border-border">
          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">{fileName}</span>
          <Badge variant="secondary" className="ml-auto shrink-0">
            {parsedCsv.rows.length} rijen
          </Badge>
        </div>

        {/* Auto-detected or manual selection */}
        {nameColumnAuto && !nameColumnConfirmed ? (
          <div className="flex flex-col gap-4">
            <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
              <p className="text-sm font-medium flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                Naamkolom herkend:{" "}
                <span className="font-mono font-semibold text-primary">
                  {nameColumn}
                </span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">Klopt dit?</p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => {
                  setNameColumnConfirmed(true);
                }}
                data-ocid="csv.confirm_button"
              >
                <Check className="w-4 h-4 mr-1.5" />
                Bevestigen
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setNameColumnAuto(false);
                  setNameColumnConfirmed(false);
                }}
                data-ocid="csv.secondary_button"
              >
                Andere kolom kiezen
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Label>Kies de kolom met de assetnaam</Label>
            <Select
              value={nameColumn}
              onValueChange={(v) => {
                setNameColumn(v);
                setNameColumnConfirmed(true);
              }}
            >
              <SelectTrigger data-ocid="csv.select">
                <SelectValue placeholder="Selecteer kolom…" />
              </SelectTrigger>
              <SelectContent>
                {headers.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Preview status */}
        {(nameColumnConfirmed || (!nameColumnAuto && nameColumn)) && (
          <div className="flex items-center gap-2 text-sm p-2 rounded bg-muted/40">
            <Check className="w-4 h-4 text-green-500 shrink-0" />
            <span className="text-muted-foreground">naamkolom</span>
            <span className="text-muted-foreground">—</span>
            <span>gekoppeld aan kolom:</span>
            <span className="font-semibold font-mono">{nameColumn}</span>
          </div>
        )}
      </div>
    );
  };

  const renderStep3 = () => {
    if (!parsedCsv) return null;
    const uniqueNames = getUniqueValues(parsedCsv.rows, nameColumn);

    const filterAssets = (search: string): AssetView[] => {
      if (!search.trim()) return assets;
      const lower = search.toLowerCase();
      return assets.filter(
        (a) =>
          a.name.toLowerCase().includes(lower) ||
          a.ticker.toLowerCase().includes(lower),
      );
    };

    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Koppel elke naam uit het bestand aan een asset in de app.
          Niet-gekoppelde rijen worden overgeslagen.
        </p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Naam in bestand</TableHead>
                <TableHead>Asset in app</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {uniqueNames.map((csvName, idx) => {
                const ticker = assetMappingState[csvName] ?? "";
                const isAutoMapped = !!(
                  savedAssetMappings[csvName] ||
                  assets.find(
                    (a) =>
                      a.name.toLowerCase() === csvName.toLowerCase() ||
                      a.ticker.toLowerCase() === csvName.toLowerCase(),
                  )
                );
                const filtered = filterAssets(assetSearchTerms[csvName] ?? "");

                return (
                  <TableRow key={csvName} data-ocid={`csv.item.${idx + 1}`}>
                    <TableCell className="font-mono text-sm font-medium">
                      {csvName}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <Input
                          placeholder="Zoek op naam of ticker…"
                          value={assetSearchTerms[csvName] ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAssetSearchTerms((prev) => ({
                              ...prev,
                              [csvName]: val,
                            }));
                            // Clear mapping if search is cleared
                            if (!val.trim()) {
                              setAssetMappingState((prev) => ({
                                ...prev,
                                [csvName]: "",
                              }));
                            }
                          }}
                          className="h-8 text-sm"
                          data-ocid="csv.search_input"
                        />
                        {assetSearchTerms[csvName] &&
                          filtered.length > 0 &&
                          !ticker && (
                            <div className="border border-border rounded-md bg-popover shadow-sm max-h-40 overflow-y-auto">
                              {filtered.slice(0, 8).map((a) => (
                                <button
                                  key={a.ticker}
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2"
                                  onClick={() => {
                                    setAssetMappingState((prev) => ({
                                      ...prev,
                                      [csvName]: a.ticker,
                                    }));
                                    setAssetSearchTerms((prev) => ({
                                      ...prev,
                                      [csvName]: `${a.ticker} — ${a.name}`,
                                    }));
                                  }}
                                >
                                  <span className="font-mono font-semibold text-xs">
                                    {a.ticker}
                                  </span>
                                  <span className="text-muted-foreground truncate">
                                    {a.name}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        {ticker && (
                          <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                            <Check className="w-3.5 h-3.5" />
                            <span>
                              {isAutoMapped
                                ? "Automatisch herkend"
                                : "Gekoppeld"}
                              : {ticker}
                            </span>
                            <button
                              type="button"
                              className="ml-auto text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setAssetMappingState((prev) => ({
                                  ...prev,
                                  [csvName]: "",
                                }));
                                setAssetSearchTerms((prev) => ({
                                  ...prev,
                                  [csvName]: "",
                                }));
                              }}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {ticker ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <X className="w-4 h-4 text-muted-foreground" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  const renderStep4 = () => {
    if (!parsedCsv) return null;
    const headers = parsedCsv.headers;

    const fields: { key: FieldName; label: string; optional?: boolean }[] = [
      { key: "type", label: "Type" },
      { key: "datum", label: "Datum" },
      { key: "aantal", label: "Aantal stuks" },
      {
        key: "prijs",
        label: prijsType === "totaal" ? "Totaalbedrag" : "Prijs per stuk",
      },
      { key: "kosten", label: "Transactiekosten", optional: true },
    ];
    // dividendBedrag is handled separately below

    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Koppel de kolommen uit het bestand aan de velden van de app.
          Automatisch herkende velden worden getoond met een groen vinkje.
        </p>

        {/* Prijs-type toggle — always visible at the top of step 4 */}
        <div className="p-3 rounded-lg bg-muted/20 border border-border flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground font-medium">
            Hoe staat de prijs in het CSV-bestand?
          </Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={prijsType === "perStuk" ? "default" : "outline"}
              className="h-7 text-xs px-3"
              onClick={() => setPrijsType("perStuk")}
              data-ocid="csv.toggle"
            >
              Prijs per stuk
            </Button>
            <Button
              type="button"
              size="sm"
              variant={prijsType === "totaal" ? "default" : "outline"}
              className="h-7 text-xs px-3"
              onClick={() => setPrijsType("totaal")}
              data-ocid="csv.toggle"
            >
              Totaalbedrag
            </Button>
          </div>
          {prijsType === "totaal" && (
            <p className="text-xs text-muted-foreground">
              De prijs per stuk wordt automatisch berekend: totaalbedrag ÷
              aantal stuks.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {fields.map(({ key, label, optional }) => {
            const mapped = fieldMappingState[key];
            const isDetected = !!mapped;

            return (
              <div key={key} className="flex flex-col gap-2">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                  <div className="shrink-0">
                    {isDetected ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : optional ? (
                      <span className="text-muted-foreground text-xs">—</span>
                    ) : (
                      <X className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  <div className="w-36 shrink-0">
                    <span className="text-sm font-medium">{label}</span>
                    {optional && (
                      <span className="text-xs text-muted-foreground ml-1">
                        (optioneel)
                      </span>
                    )}
                  </div>
                  {isDetected ? (
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-sm text-muted-foreground">
                        gekoppeld aan:
                      </span>
                      <span className="font-mono font-semibold text-sm">
                        {mapped}
                      </span>
                      <button
                        type="button"
                        className="ml-auto text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          setFieldMappingState((prev) => ({
                            ...prev,
                            [key]: "",
                          }))
                        }
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <Select
                      value={fieldMappingState[key]}
                      onValueChange={(v) => {
                        const val = v === "__none__" ? "" : v;
                        setFieldMappingState((prev) => ({
                          ...prev,
                          [key]: val,
                        }));
                      }}
                    >
                      <SelectTrigger
                        className="flex-1 h-8 text-sm"
                        data-ocid="csv.select"
                      >
                        <SelectValue
                          placeholder={
                            optional ? "Geen (overslaan)" : "Kies kolom…"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {optional && (
                          <SelectItem value="__none__">Geen</SelectItem>
                        )}
                        {headers.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            );
          })}

          {/* Dividend ontvangen bedrag — only for stocks */}
          {assetType === "stock" && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2 p-3 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-3">
                  <div className="shrink-0">
                    {fieldMappingState.dividendBedrag ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </div>
                  <div className="w-36 shrink-0">
                    <span className="text-sm font-medium">Dividend bedrag</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      (optioneel)
                    </span>
                  </div>
                  <Select
                    value={fieldMappingState.dividendBedrag || "__zelfde__"}
                    onValueChange={(v) => {
                      const val = v === "__zelfde__" ? "" : v;
                      setFieldMappingState((prev) => ({
                        ...prev,
                        dividendBedrag: val,
                      }));
                    }}
                  >
                    <SelectTrigger
                      className="flex-1 h-8 text-sm"
                      data-ocid="csv.select"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__zelfde__">
                        Zelfde als totaalbedrag-kolom (standaard)
                      </SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground pl-8">
                  Standaard wordt de ingestelde totaalbedrag-kolom gebruikt als
                  ontvangen dividendbedrag. Kies een andere kolom als het
                  dividendbedrag in een aparte kolom staat.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStep5 = () => {
    if (!parsedCsv || !fieldMappingState.type) {
      return (
        <div className="text-sm text-muted-foreground p-4 text-center">
          Geen typekolom geselecteerd in stap 4.
        </div>
      );
    }

    const typeValues = getUniqueValues(parsedCsv.rows, fieldMappingState.type);
    const typeOptions =
      assetType === "crypto"
        ? [
            { value: "buy", label: "Aankoop" },
            { value: "sell", label: "Verkoop" },
            { value: "stakingReward", label: "Staking reward" },
          ]
        : [
            { value: "buy", label: "Aankoop" },
            { value: "sell", label: "Verkoop" },
            { value: "dividend", label: "Dividend" },
            { value: "ongoingCosts", label: "Lopende kosten" },
          ];

    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Vertaal de transactietypes uit het bestand naar de types in de app.
        </p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Waarde in bestand</TableHead>
                <TableHead>Type in app</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {typeValues.map((val, idx) => {
                const translated = typeTranslationState[val] ?? "";
                const isAuto =
                  !!savedTypeTranslations[val] ||
                  !!(
                    assetType === "crypto" ? TYPE_AUTO_CRYPTO : TYPE_AUTO_STOCK
                  )[val.toLowerCase()] ||
                  !!(
                    assetType === "crypto" ? TYPE_AUTO_CRYPTO : TYPE_AUTO_STOCK
                  )[val];

                return (
                  <TableRow key={val} data-ocid={`csv.item.${idx + 1}`}>
                    <TableCell>
                      {translated ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <X className="w-4 h-4 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{val}</TableCell>
                    <TableCell>
                      {translated && isAuto ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {TRANSACTION_TYPE_LABELS[translated] ?? translated}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            (automatisch)
                          </span>
                        </div>
                      ) : (
                        <Select
                          value={translated}
                          onValueChange={(v) =>
                            setTypeTranslationState((prev) => ({
                              ...prev,
                              [val]: v,
                            }))
                          }
                        >
                          <SelectTrigger
                            className="w-48 h-8 text-sm"
                            data-ocid="csv.select"
                          >
                            <SelectValue placeholder="Selecteer type…" />
                          </SelectTrigger>
                          <SelectContent>
                            {typeOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  const renderStep6 = () => {
    const activeRows = editableRows.filter((r) => !r.deleted);
    const toImportRows = activeRows.filter((r) => r.isValid && !r.isDuplicate);
    const duplicateRows = activeRows.filter((r) => r.isValid && r.isDuplicate);
    const invalidRows = activeRows.filter((r) => !r.isValid);

    const typeOptions =
      assetType === "crypto"
        ? [
            { value: "buy", label: "Aankoop" },
            { value: "sell", label: "Verkoop" },
            { value: "stakingReward", label: "Staking reward" },
          ]
        : [
            { value: "buy", label: "Aankoop" },
            { value: "sell", label: "Verkoop" },
            { value: "dividend", label: "Dividend" },
            { value: "ongoingCosts", label: "Lopende kosten" },
          ];

    const isDividendLikeType = (type: string) =>
      type === "dividend" ||
      type === "stakingReward" ||
      type === "ongoingCosts";

    return (
      <div className="flex flex-col gap-4">
        {/* Summary tiles */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-muted/40 border border-border text-center">
            <p className="text-2xl font-bold text-foreground">
              {toImportRows.length}
            </p>
            <p className="text-xs text-muted-foreground">te importeren</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/40 border border-border text-center">
            <p className="text-2xl font-bold text-muted-foreground">
              {duplicateRows.length}
            </p>
            <p className="text-xs text-muted-foreground">duplicaten</p>
          </div>
          <div
            className={cn(
              "p-3 rounded-lg border text-center",
              invalidRows.length > 0
                ? "bg-destructive/10 border-destructive/30"
                : "bg-muted/40 border-border",
            )}
          >
            <p
              className={cn(
                "text-2xl font-bold",
                invalidRows.length > 0
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {invalidRows.length}
            </p>
            <p className="text-xs text-muted-foreground">ongeldig</p>
          </div>
        </div>

        {/* Ongeldige regels detail panel */}
        {invalidRows.length > 0 && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-destructive/10 transition-colors"
              onClick={() => setInvalidRowsExpanded((v) => !v)}
            >
              <span className="flex items-center gap-2 font-medium text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Ongeldige regels ({invalidRows.length}) — worden niet
                geïmporteerd
              </span>
              {invalidRowsExpanded ? (
                <ChevronDown className="w-4 h-4 text-destructive/70" />
              ) : (
                <ChevronRight className="w-4 h-4 text-destructive/70" />
              )}
            </button>
            {invalidRowsExpanded && (
              <div className="px-3 pb-3 flex flex-col gap-2">
                {invalidRows.map((row, idx) => (
                  <div
                    key={row.id}
                    className="flex flex-col gap-0.5 p-2 rounded bg-destructive/10 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-muted-foreground w-6 shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="font-mono font-semibold">
                        {row.ticker || row.csvName}
                      </span>
                      <span className="text-muted-foreground">
                        {row.dateStr || formatPreviewDate(row.date)}
                      </span>
                    </div>
                    <div className="pl-8 text-destructive font-medium">
                      {row.errorReason ?? "Onbekende fout"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Import error details panel (shown after import with errors) */}
        {importErrorDetails.length > 0 && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-destructive/10 transition-colors"
              onClick={() => setImportErrorsExpanded((v) => !v)}
            >
              <span className="flex items-center gap-2 font-medium text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Importfouten ({importErrorDetails.length}) — klik voor details
              </span>
              {importErrorsExpanded ? (
                <ChevronDown className="w-4 h-4 text-destructive/70" />
              ) : (
                <ChevronRight className="w-4 h-4 text-destructive/70" />
              )}
            </button>
            {importErrorsExpanded && (
              <div className="px-3 pb-3 flex flex-col gap-2">
                {importErrorDetails.map((err, idx) => (
                  <div
                    key={`${err.ticker}-${err.dateStr}-${idx}`}
                    className="flex flex-col gap-0.5 p-2 rounded bg-destructive/10 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-muted-foreground w-6 shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="font-mono font-semibold">
                        {err.ticker}
                      </span>
                      <span className="text-muted-foreground">
                        {err.dateStr}
                      </span>
                    </div>
                    <div className="pl-8 text-destructive font-medium">
                      {err.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {toImportRows.length === 0 && duplicateRows.length === 0 ? (
          <div
            className="text-center p-8 text-muted-foreground text-sm"
            data-ocid="csv.empty_state"
          >
            Geen nieuwe transacties om te importeren.
          </div>
        ) : (
          <>
            {toImportRows.length > 0 && (
              <>
                <p className="text-sm text-muted-foreground">
                  Controleer en pas de gegevens aan voor de import. Je kunt
                  waarden bewerken of regels verwijderen.
                </p>

                {/* ── Mobile card view (< md) ─────────────────────────── */}
                <div className="md:hidden flex flex-col gap-2 max-h-[45vh] overflow-y-auto">
                  {toImportRows.map((row, idx) => (
                    <div
                      key={row.id}
                      className="rounded-lg border border-border bg-muted/20 p-3 flex flex-col gap-2"
                      data-ocid={`csv.row.${idx + 1}`}
                    >
                      {/* Top line: date | type | delete */}
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          value={row.dateStr}
                          onChange={(e) => {
                            const val = e.target.value;
                            const parsed = parseDateStr(val);
                            updateEditableRow(row.id, {
                              dateStr: val,
                              date: parsed,
                              isValid: !!parsed,
                              errorReason: parsed
                                ? undefined
                                : `Ongeldige datum: '${val}'`,
                            });
                          }}
                          placeholder="DD-MM-YYYY"
                          className="h-7 text-xs px-2 font-mono w-[100px] shrink-0"
                        />
                        <Select
                          value={row.transactionType}
                          onValueChange={(v) =>
                            updateEditableRow(row.id, { transactionType: v })
                          }
                        >
                          <SelectTrigger className="h-7 text-xs px-2 flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {typeOptions.map((opt) => (
                              <SelectItem
                                key={opt.value}
                                value={opt.value}
                                className="text-xs"
                              >
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteEditableRow(row.id)}
                          data-ocid={`csv.delete_button.${idx + 1}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      {/* Middle line: asset */}
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold">
                          {row.ticker}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {row.assetName}
                        </span>
                      </div>

                      {/* Bottom line: inputs */}
                      {isDividendLikeType(row.transactionType) ? (
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs text-muted-foreground">
                            Bedrag (€)
                          </Label>
                          <Input
                            type="number"
                            step="any"
                            value={row.euroValue === 0 ? "" : row.euroValue}
                            onChange={(e) =>
                              updateEditableRow(row.id, {
                                euroValue:
                                  Number.parseFloat(e.target.value) || 0,
                              })
                            }
                            className="h-7 text-xs px-2 font-mono"
                            placeholder="€"
                          />
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          <div className="flex flex-col gap-1">
                            <Label className="text-xs text-muted-foreground">
                              Aantal
                            </Label>
                            <Input
                              type="number"
                              step="any"
                              value={row.quantity === 0 ? "" : row.quantity}
                              onChange={(e) =>
                                updateEditableRow(row.id, {
                                  quantity:
                                    Number.parseFloat(e.target.value) || 0,
                                })
                              }
                              className="h-7 text-xs px-2 font-mono"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label className="text-xs text-muted-foreground">
                              Prijs (€)
                            </Label>
                            <Input
                              type="number"
                              step="any"
                              value={
                                row.pricePerUnit === 0 ? "" : row.pricePerUnit
                              }
                              onChange={(e) =>
                                updateEditableRow(row.id, {
                                  pricePerUnit:
                                    Number.parseFloat(e.target.value) || 0,
                                })
                              }
                              className="h-7 text-xs px-2 font-mono"
                              placeholder="€"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label className="text-xs text-muted-foreground">
                              Kosten
                            </Label>
                            <Input
                              type="number"
                              step="any"
                              value={row.fees === 0 ? "" : row.fees}
                              onChange={(e) =>
                                updateEditableRow(row.id, {
                                  fees: Number.parseFloat(e.target.value) || 0,
                                })
                              }
                              className="h-7 text-xs px-2 font-mono"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* ── Desktop table view (md+) ────────────────────────── */}
                <div className="hidden md:block max-h-[45vh] overflow-y-auto overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead className="text-xs py-2 min-w-[110px]">
                          Datum
                        </TableHead>
                        <TableHead className="text-xs py-2 min-w-[100px]">
                          Asset
                        </TableHead>
                        <TableHead className="text-xs py-2 min-w-[130px]">
                          Type
                        </TableHead>
                        <TableHead className="text-xs py-2 min-w-[80px] text-right">
                          Aantal
                        </TableHead>
                        <TableHead className="text-xs py-2 min-w-[100px] text-right">
                          Prijs/€
                        </TableHead>
                        <TableHead className="text-xs py-2 min-w-[80px] text-right">
                          Kosten
                        </TableHead>
                        <TableHead className="text-xs py-2 w-8" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {toImportRows.map((row, idx) => (
                        <TableRow
                          key={row.id}
                          data-ocid={`csv.row.${idx + 1}`}
                          className="hover:bg-muted/20"
                        >
                          {/* Datum */}
                          <TableCell className="py-1.5 px-2">
                            <Input
                              type="text"
                              value={row.dateStr}
                              onChange={(e) => {
                                const val = e.target.value;
                                const parsed = parseDateStr(val);
                                updateEditableRow(row.id, {
                                  dateStr: val,
                                  date: parsed,
                                  isValid: !!parsed,
                                  errorReason: parsed
                                    ? undefined
                                    : `Ongeldige datum: '${val}'`,
                                });
                              }}
                              placeholder="DD-MM-YYYY"
                              className="h-7 text-xs px-2 font-mono w-[100px]"
                            />
                          </TableCell>

                          {/* Asset (read-only) */}
                          <TableCell className="py-1.5 px-2">
                            <div className="flex flex-col">
                              <span className="font-mono text-xs font-semibold leading-tight">
                                {row.ticker}
                              </span>
                              <span className="text-xs text-muted-foreground truncate max-w-[90px]">
                                {row.assetName}
                              </span>
                            </div>
                          </TableCell>

                          {/* Type */}
                          <TableCell className="py-1.5 px-2">
                            <Select
                              value={row.transactionType}
                              onValueChange={(v) =>
                                updateEditableRow(row.id, {
                                  transactionType: v,
                                })
                              }
                            >
                              <SelectTrigger className="h-7 text-xs px-2 w-[120px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {typeOptions.map((opt) => (
                                  <SelectItem
                                    key={opt.value}
                                    value={opt.value}
                                    className="text-xs"
                                  >
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>

                          {/* Aantal */}
                          <TableCell className="py-1.5 px-2 text-right">
                            {isDividendLikeType(row.transactionType) ? (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            ) : (
                              <Input
                                type="number"
                                step="any"
                                value={row.quantity === 0 ? "" : row.quantity}
                                onChange={(e) =>
                                  updateEditableRow(row.id, {
                                    quantity:
                                      Number.parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="h-7 text-xs px-2 text-right w-[75px] font-mono"
                              />
                            )}
                          </TableCell>

                          {/* Prijs per stuk / Euro-waarde */}
                          <TableCell className="py-1.5 px-2 text-right">
                            {isDividendLikeType(row.transactionType) ? (
                              <Input
                                type="number"
                                step="any"
                                value={row.euroValue === 0 ? "" : row.euroValue}
                                onChange={(e) =>
                                  updateEditableRow(row.id, {
                                    euroValue:
                                      Number.parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="h-7 text-xs px-2 text-right w-[90px] font-mono"
                                placeholder="€"
                              />
                            ) : (
                              <Input
                                type="number"
                                step="any"
                                value={
                                  row.pricePerUnit === 0 ? "" : row.pricePerUnit
                                }
                                onChange={(e) =>
                                  updateEditableRow(row.id, {
                                    pricePerUnit:
                                      Number.parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="h-7 text-xs px-2 text-right w-[90px] font-mono"
                                placeholder="€"
                              />
                            )}
                          </TableCell>

                          {/* Kosten */}
                          <TableCell className="py-1.5 px-2 text-right">
                            {isDividendLikeType(row.transactionType) ? (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            ) : (
                              <Input
                                type="number"
                                step="any"
                                value={row.fees === 0 ? "" : row.fees}
                                onChange={(e) =>
                                  updateEditableRow(row.id, {
                                    fees:
                                      Number.parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="h-7 text-xs px-2 text-right w-[75px] font-mono"
                                placeholder="0"
                              />
                            )}
                          </TableCell>

                          {/* Delete */}
                          <TableCell className="py-1.5 px-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteEditableRow(row.id)}
                              data-ocid={`csv.delete_button.${idx + 1}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            {/* Duplicaten collapsible */}
            {duplicateRows.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-2 text-sm bg-muted/30 hover:bg-muted/50 transition-colors"
                  onClick={() => setDuplicatesExpanded((v) => !v)}
                >
                  <span className="font-medium text-muted-foreground">
                    Duplicaten ({duplicateRows.length}) — worden overgeslagen
                  </span>
                  {duplicatesExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
                {duplicatesExpanded && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs py-2">Datum</TableHead>
                          <TableHead className="text-xs py-2">Asset</TableHead>
                          <TableHead className="text-xs py-2">Type</TableHead>
                          <TableHead className="text-xs py-2 text-right">
                            Aantal
                          </TableHead>
                          <TableHead className="text-xs py-2 text-right">
                            Prijs/€
                          </TableHead>
                          <TableHead className="text-xs py-2 w-8" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {duplicateRows.map((row, idx) => (
                          <TableRow
                            key={row.id}
                            className="opacity-60"
                            data-ocid={`csv.row.${toImportRows.length + idx + 1}`}
                          >
                            <TableCell className="py-1.5 text-xs font-mono">
                              {formatPreviewDate(row.date)}
                            </TableCell>
                            <TableCell className="py-1.5">
                              <div className="flex flex-col">
                                <span className="font-mono text-xs font-semibold">
                                  {row.ticker}
                                </span>
                                <span className="text-xs text-muted-foreground truncate max-w-[90px]">
                                  {row.assetName}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-1.5">
                              <Badge variant="outline" className="text-xs">
                                {TRANSACTION_TYPE_LABELS[row.transactionType] ??
                                  row.transactionType}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-1.5 text-right text-xs font-mono">
                              {isDividendLikeType(row.transactionType)
                                ? "—"
                                : row.quantity.toFixed(4)}
                            </TableCell>
                            <TableCell className="py-1.5 text-right text-xs font-mono">
                              {isDividendLikeType(row.transactionType)
                                ? formatEuro(row.euroValue)
                                : formatEuro(row.pricePerUnit, 6)}
                            </TableCell>
                            <TableCell className="py-1.5 px-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteEditableRow(row.id)}
                                data-ocid={`csv.delete_button.${toImportRows.length + idx + 1}`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // ─── Navigation guards ────────────────────────────────────────────────────

  const canProceedStep2 =
    !!nameColumn && (nameColumnConfirmed || (!nameColumnAuto && !!nameColumn));

  const canProceedStep4 = !!fieldMappingState.type && !!fieldMappingState.datum;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="w-full sm:max-w-3xl max-h-[95vh] sm:max-h-[90vh] flex flex-col"
        data-ocid="csv.dialog"
      >
        <DialogHeader>
          <DialogTitle>
            CSV importeren — {assetType === "stock" ? "Aandelen" : "Crypto"}
          </DialogTitle>
          <StepIndicator current={step} total={6} />
        </DialogHeader>

        {/* Step progress bar */}
        <div className="flex gap-1 mb-2">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                n <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto py-2 min-h-0">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
          {step === 6 && renderStep6()}
        </div>

        <DialogFooter className="flex flex-row items-center justify-between mt-4 gap-2">
          <div className="flex gap-2">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep((s) => s - 1)}
                disabled={isImporting}
                data-ocid="csv.secondary_button"
              >
                Vorige
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={isImporting}
              data-ocid="csv.cancel_button"
            >
              Annuleren
            </Button>
          </div>

          <div>
            {step === 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                data-ocid="csv.upload_button"
              >
                <Upload className="w-4 h-4 mr-1.5" />
                Bestand kiezen
              </Button>
            )}
            {step === 2 && (
              <Button
                type="button"
                size="sm"
                disabled={!canProceedStep2}
                onClick={goToStep3}
                data-ocid="csv.primary_button"
              >
                Volgende
              </Button>
            )}
            {step === 3 && (
              <Button
                type="button"
                size="sm"
                onClick={goToStep4}
                data-ocid="csv.primary_button"
              >
                Volgende
              </Button>
            )}
            {step === 4 && (
              <Button
                type="button"
                size="sm"
                disabled={!canProceedStep4}
                onClick={goToStep5}
                data-ocid="csv.primary_button"
              >
                Volgende
              </Button>
            )}
            {step === 5 && (
              <Button
                type="button"
                size="sm"
                onClick={goToStep6}
                data-ocid="csv.primary_button"
              >
                Volgende
              </Button>
            )}
            {step === 6 && (
              <Button
                type="button"
                size="sm"
                disabled={
                  isImporting ||
                  editableRows.filter(
                    (r) => !r.deleted && r.isValid && !r.isDuplicate,
                  ).length === 0
                }
                onClick={handleImport}
                data-ocid="csv.submit_button"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Importeren…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Importeren
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
