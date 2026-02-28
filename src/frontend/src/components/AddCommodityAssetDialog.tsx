import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Loader2, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AssetType, type AssetView } from "../backend.d";
import { useCommodities } from "../hooks/useCommodities";
import { useAddAsset } from "../hooks/useQueries";

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

interface AddCommodityAssetDialogProps {
  assets: AssetView[];
  children?: React.ReactNode;
}

interface CommodityAssetForm {
  commodityType: CommodityType | "";
  unit: string;
  currentPrice: string;
}

const INITIAL_FORM: CommodityAssetForm = {
  commodityType: "",
  unit: "",
  currentPrice: "",
};

export function AddCommodityAssetDialog({
  assets,
  children,
}: AddCommodityAssetDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CommodityAssetForm>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addAsset = useAddAsset();
  const { addCommodityTicker } = useCommodities();

  const existingTickers = useMemo(() => assets.map((a) => a.ticker), [assets]);

  const handleTypeChange = (type: string) => {
    const ct = type as CommodityType;
    setForm((p) => ({
      ...p,
      commodityType: ct,
      unit: DEFAULT_UNIT[ct] ?? "",
      currentPrice: "",
    }));
  };

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

    const baseTicker = COMMODITY_TICKER[form.commodityType];
    const ticker = generateUniqueTicker(baseTicker, existingTickers);
    const name = form.commodityType;

    const rawPrice = form.currentPrice.trim().replace(",", ".");
    const currentPrice = rawPrice !== "" ? Number.parseFloat(rawPrice) : 0;

    setIsSubmitting(true);
    try {
      // Create the asset (stored as AssetType.stock) with unit info in name
      await addAsset.mutateAsync({
        name: `${name} (${form.unit})`,
        ticker,
        assetType: AssetType.stock,
        currentPrice:
          Number.isNaN(currentPrice) || currentPrice < 0 ? 0 : currentPrice,
      });

      // Mark this ticker as a commodity in localStorage
      addCommodityTicker(ticker);

      toast.success(`${name} toegevoegd — voeg nu een transactie toe`);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-semibold">
            Grondstof toevoegen
          </DialogTitle>
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

          {/* Unit — dropdown with free-text override */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="commodity-unit">
              Eenheid <span className="text-loss">*</span>
            </Label>
            <Select
              value={
                COMMODITY_UNITS.includes(form.unit as CommodityUnit)
                  ? form.unit
                  : "__custom__"
              }
              onValueChange={(v) => {
                if (v !== "__custom__") {
                  setForm((p) => ({ ...p, unit: v }));
                }
              }}
            >
              <SelectTrigger>
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
            <Input
              id="commodity-unit"
              placeholder="bijv. troy ounce"
              value={form.unit}
              onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
              required
            />
          </div>

          {/* Current price (optional, manually entered) */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="commodity-price">
              Huidige prijs per eenheid (€)
            </Label>
            <Input
              id="commodity-price"
              type="number"
              step="0.000001"
              min="0"
              placeholder="bijv. 2800,00"
              value={form.currentPrice}
              onChange={(e) =>
                setForm((p) => ({ ...p, currentPrice: e.target.value }))
              }
              className="num"
            />
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annuleren
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Toevoegen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
