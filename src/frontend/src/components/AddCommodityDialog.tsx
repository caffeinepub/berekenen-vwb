import { useState, useMemo } from "react";
import { toast } from "sonner";
import { AssetType, AssetView, TransactionType } from "../backend.d";
import { useAddAsset, useAddTransaction } from "../hooks/useQueries";
import { useCommodities } from "../hooks/useCommodities";
import { dateToBigintNano, dateInputToDate, todayInputValue } from "../utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { formatEuro } from "../utils/format";

// ─── Commodity definitions ────────────────────────────────────────────────────

const COMMODITY_TYPES = [
  "Goud",
  "Zilver",
  "Platinum",
  "Palladium",
  "Koper",
  "Olie (WTI)",
  "Olie (Brent)",
  "Aardgas",
  "Tarwe",
  "Mais",
  "Koffie",
  "Cacao",
  "Suiker",
] as const;

const COMMODITY_UNITS = [
  "Troy ounce",
  "Gram",
  "Kilogram",
  "Vat",
  "MMBtu",
  "Bushel",
  "Pond",
] as const;

type CommodityType = (typeof COMMODITY_TYPES)[number];
type CommodityUnit = (typeof COMMODITY_UNITS)[number];

/** Map each commodity type to its default unit */
const DEFAULT_UNIT: Record<CommodityType, CommodityUnit> = {
  Goud: "Troy ounce",
  Zilver: "Troy ounce",
  Platinum: "Troy ounce",
  Palladium: "Troy ounce",
  Koper: "Kilogram",
  "Olie (WTI)": "Vat",
  "Olie (Brent)": "Vat",
  Aardgas: "MMBtu",
  Tarwe: "Bushel",
  Mais: "Bushel",
  Koffie: "Pond",
  Cacao: "Pond",
  Suiker: "Pond",
};

/** Map each commodity type to a fixed ticker symbol */
const COMMODITY_TICKER: Record<CommodityType, string> = {
  Goud: "GOUD",
  Zilver: "ZILVER",
  Platinum: "PLAT",
  Palladium: "PALL",
  Koper: "KOPER",
  "Olie (WTI)": "WTI",
  "Olie (Brent)": "BRENT",
  Aardgas: "AARDGAS",
  Tarwe: "TARWE",
  Mais: "MAIS",
  Koffie: "KOFFIE",
  Cacao: "CACAO",
  Suiker: "SUIKER",
};

/** Generate a unique ticker by appending a suffix when base ticker already exists */
function generateUniqueTicker(base: string, existingTickers: string[]): string {
  if (!existingTickers.includes(base)) return base;
  let i = 1;
  while (existingTickers.includes(`${base}-${i}`)) {
    i++;
  }
  return `${base}-${i}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AddCommodityDialogProps {
  assets: AssetView[];
  children?: React.ReactNode;
}

interface CommodityForm {
  commodityType: CommodityType | "";
  unit: string;
  date: string;
  quantity: string;
  pricePerUnit: string;
  fees: string;
  notes: string;
}

const INITIAL_FORM: CommodityForm = {
  commodityType: "",
  unit: "",
  date: todayInputValue(),
  quantity: "",
  pricePerUnit: "",
  fees: "",
  notes: "",
};

export function AddCommodityDialog({ assets, children }: AddCommodityDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CommodityForm>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addAsset = useAddAsset();
  const addTransaction = useAddTransaction();
  const { addCommodityTicker } = useCommodities();

  const existingTickers = useMemo(() => assets.map((a) => a.ticker), [assets]);

  const handleTypeChange = (type: string) => {
    const ct = type as CommodityType;
    setForm((p) => ({
      ...p,
      commodityType: ct,
      unit: DEFAULT_UNIT[ct] ?? "",
    }));
  };

  const quantity = parseFloat(form.quantity.replace(",", "."));
  const pricePerUnit = parseFloat(form.pricePerUnit.replace(",", "."));
  const fees = form.fees ? parseFloat(form.fees.replace(",", ".")) : 0;
  const totalAmount =
    !isNaN(quantity) && !isNaN(pricePerUnit) ? quantity * pricePerUnit : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.commodityType) {
      toast.error("Selecteer een type grondstof");
      return;
    }
    if (!form.unit.trim()) {
      toast.error("Eenheid is verplicht");
      return;
    }
    if (isNaN(quantity) || quantity <= 0) {
      toast.error("Vul een positief aantal eenheden in");
      return;
    }
    if (isNaN(pricePerUnit) || pricePerUnit < 0) {
      toast.error("Vul een geldige prijs per eenheid in");
      return;
    }
    if (form.fees && isNaN(fees)) {
      toast.error("Ongeldige transactiekosten");
      return;
    }

    const baseTicker = COMMODITY_TICKER[form.commodityType];
    const ticker = generateUniqueTicker(baseTicker, existingTickers);
    const name = form.commodityType;
    const dateObj = dateInputToDate(form.date);
    const dateBigint = dateToBigintNano(dateObj);

    setIsSubmitting(true);
    try {
      // 1) Create the asset (stored as AssetType.stock)
      await addAsset.mutateAsync({
        name,
        ticker,
        assetType: AssetType.stock,
        currentPrice: pricePerUnit,
      });

      // 2) Mark this ticker as a commodity in localStorage
      addCommodityTicker(ticker);

      // 3) Add the initial buy transaction
      await addTransaction.mutateAsync({
        asset: ticker,
        transactionType: TransactionType.buy,
        date: dateBigint,
        quantity,
        pricePerUnit,
        fees: form.fees ? fees : undefined,
        notes: form.notes.trim()
          ? `[Eenheid: ${form.unit}] ${form.notes.trim()}`
          : `[Eenheid: ${form.unit}]`,
      });

      toast.success(`${name} (${ticker}) toegevoegd`);
      setForm(INITIAL_FORM);
      setOpen(false);
    } catch {
      toast.error("Fout bij het toevoegen van grondstof");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button size="sm" variant="outline">
            <Plus className="w-4 h-4 mr-1.5" />
            Grondstof toevoegen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-semibold">Grondstof toevoegen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          {/* Commodity type */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="commodity-type">
              Type grondstof <span className="text-loss">*</span>
            </Label>
            <Select value={form.commodityType} onValueChange={handleTypeChange}>
              <SelectTrigger id="commodity-type">
                <SelectValue placeholder="Selecteer type…" />
              </SelectTrigger>
              <SelectContent>
                {COMMODITY_TYPES.map((ct) => (
                  <SelectItem key={ct} value={ct}>
                    {ct}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Unit — dropdown with free-text fallback via Input */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="commodity-unit">
              Eenheid <span className="text-loss">*</span>
            </Label>
            <div className="flex gap-2">
              <Select
                value={COMMODITY_UNITS.includes(form.unit as CommodityUnit) ? form.unit : "__custom__"}
                onValueChange={(v) => {
                  if (v !== "__custom__") {
                    setForm((p) => ({ ...p, unit: v }));
                  }
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecteer eenheid…" />
                </SelectTrigger>
                <SelectContent>
                  {COMMODITY_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom__">Vrije invoer…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Always show a free-text input so the user can override or enter custom unit */}
            <Input
              id="commodity-unit"
              placeholder="bijv. troy ounce"
              value={form.unit}
              onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
              required
            />
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="commodity-date">
              Datum <span className="text-loss">*</span>
            </Label>
            <Input
              id="commodity-date"
              type="date"
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              required
            />
          </div>

          {/* Quantity */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="commodity-qty">
              Aantal eenheden <span className="text-loss">*</span>
            </Label>
            <Input
              id="commodity-qty"
              type="number"
              step="any"
              min="0.00000001"
              placeholder="0,0000"
              value={form.quantity}
              onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
              required
            />
          </div>

          {/* Price per unit */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="commodity-price">
              Prijs per eenheid (€) <span className="text-loss">*</span>
            </Label>
            <Input
              id="commodity-price"
              type="number"
              step="0.000001"
              min="0"
              placeholder="0,000000"
              value={form.pricePerUnit}
              onChange={(e) => setForm((p) => ({ ...p, pricePerUnit: e.target.value }))}
              required
            />
          </div>

          {/* Total amount (read-only) */}
          {totalAmount > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>Totaalbedrag</Label>
              <div className="h-9 px-3 rounded-md border border-input bg-muted/40 flex items-center text-sm font-medium num">
                {formatEuro(totalAmount)}
              </div>
            </div>
          )}

          {/* Fees */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="commodity-fees">Transactiekosten (€)</Label>
            <Input
              id="commodity-fees"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={form.fees}
              onChange={(e) => setForm((p) => ({ ...p, fees: e.target.value }))}
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="commodity-notes">Notitie</Label>
            <Textarea
              id="commodity-notes"
              placeholder="Optionele notitie…"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="resize-none"
            />
          </div>

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Toevoegen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
