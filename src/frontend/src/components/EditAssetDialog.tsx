import { useState } from "react";
import { toast } from "sonner";
import { AssetView, AssetType } from "../backend.d";
import { useUpdateAsset } from "../hooks/useQueries";
import { setEtfFlag, getEtfFlag } from "../utils/ter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Loader2 } from "lucide-react";

// Internal form type: distinguishes ETF from regular stock
type FormAssetType = "stock" | "etf" | "crypto";

interface EditAssetDialogProps {
  asset: AssetView;
  children?: React.ReactNode;
  ongoingCostsEnabled?: boolean;
  terValue?: number;
  updateOngoingCosts?: (ticker: string, enabled: boolean) => void;
  updateTer?: (ticker: string, pct: number | null) => void;
  /** When true, hides the type-select and TER section (commodities) */
  isCommodity?: boolean;
}

function getInitialFormType(asset: AssetView): FormAssetType {
  if (asset.assetType === AssetType.crypto) return "crypto";
  // Check ETF flag from localStorage
  if (getEtfFlag(asset.ticker)) return "etf";
  return "stock";
}

export function EditAssetDialog({
  asset,
  children,
  ongoingCostsEnabled = false,
  terValue,
  updateOngoingCosts,
  updateTer,
  isCommodity = false,
}: EditAssetDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: asset.name,
    formType: getInitialFormType(asset) as FormAssetType,
    currentPrice: String(asset.currentPrice),
    hasOngoingCosts: ongoingCostsEnabled,
    ter: terValue !== undefined && terValue !== null ? String(terValue) : "",
  });
  const updateAsset = useUpdateAsset();

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setForm({
        name: asset.name,
        formType: getInitialFormType(asset),
        currentPrice: String(asset.currentPrice),
        hasOngoingCosts: ongoingCostsEnabled,
        ter: terValue !== undefined && terValue !== null ? String(terValue) : "",
      });
    }
    setOpen(isOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error("Naam is verplicht");
      return;
    }

    const price = form.currentPrice
      ? parseFloat(form.currentPrice.replace(",", "."))
      : 0;
    if (form.currentPrice && (isNaN(price) || price < 0)) {
      toast.error("Ongeldige huidige prijs");
      return;
    }

    // Map form type back to backend AssetType
    const backendType = form.formType === "crypto" ? AssetType.crypto : AssetType.stock;

    try {
      await updateAsset.mutateAsync({
        ticker: asset.ticker,
        name: form.name.trim(),
        assetType: backendType,
        currentPrice: isNaN(price) ? 0 : price,
      });

      // Persist ETF flag
      setEtfFlag(asset.ticker, form.formType === "etf");

      if (updateOngoingCosts) {
        updateOngoingCosts(asset.ticker, form.hasOngoingCosts);
      }
      if (form.hasOngoingCosts && form.ter && updateTer) {
        const terPct = parseFloat(form.ter.replace(",", "."));
        if (!isNaN(terPct) && terPct >= 0) {
          updateTer(asset.ticker, terPct);
        }
      } else if (!form.hasOngoingCosts && updateTer) {
        updateTer(asset.ticker, null);
      }

      toast.success(`${asset.ticker} bijgewerkt`);
      setOpen(false);
    } catch {
      toast.error("Fout bij het bijwerken van asset");
    }
  };

  // TER/ongoing costs only shown for ETF type
  const isEtf = form.formType === "etf";
  const isCrypto = form.formType === "crypto";

  const typeLabel = (t: FormAssetType) => {
    if (t === "etf") return "ETF";
    if (t === "crypto") return "Crypto";
    return "Aandeel";
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-semibold">Asset bewerken</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-asset-ticker">Ticker</Label>
            <Input
              id="edit-asset-ticker"
              value={asset.ticker}
              readOnly
              className="font-mono uppercase bg-muted/50 text-muted-foreground cursor-not-allowed"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-asset-name">
              Naam <span className="text-loss">*</span>
            </Label>
            <Input
              id="edit-asset-name"
              placeholder="bijv. Apple Inc."
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </div>

          {/* Type selector — stocks/ETF only (not crypto, not commodity) */}
          {!isCommodity && !isCrypto && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-asset-type">Type</Label>
              <Select
                value={form.formType}
                onValueChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    formType: v as FormAssetType,
                    hasOngoingCosts: false,
                    ter: "",
                  }))
                }
              >
                <SelectTrigger id="edit-asset-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock">Aandeel</SelectItem>
                  <SelectItem value="etf">ETF</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {/* Locked type display for crypto */}
          {isCrypto && (
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <div className="h-9 px-3 rounded-md border border-input bg-muted/40 flex items-center text-sm text-muted-foreground">
                {typeLabel(form.formType)}
              </div>
            </div>
          )}
          {/* Locked type display for commodity */}
          {isCommodity && (
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <div className="h-9 px-3 rounded-md border border-input bg-muted/40 flex items-center text-sm text-muted-foreground">
                Grondstof
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-asset-price">Huidige prijs (€)</Label>
            <Input
              id="edit-asset-price"
              type="number"
              step="0.000001"
              min="0"
              placeholder="0,00"
              value={form.currentPrice}
              onChange={(e) =>
                setForm((p) => ({ ...p, currentPrice: e.target.value }))
              }
            />
          </div>

          {/* Ongoing costs / TER — only for ETF */}
          {isEtf && (
            <>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
                  <Checkbox
                    id="edit-asset-ongoing-costs"
                    checked={form.hasOngoingCosts}
                    onCheckedChange={(checked) =>
                      setForm((p) => ({ ...p, hasOngoingCosts: checked === true }))
                    }
                    className="mt-0.5"
                  />
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="edit-asset-ongoing-costs" className="cursor-pointer font-medium text-sm">
                      Lopende kosten van toepassing
                    </Label>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Vink aan als dit ETF jaarlijkse lopende kosten (TER) heeft
                    </p>
                  </div>
                </div>
              </div>

              {form.hasOngoingCosts && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-asset-ter">TER – lopende kosten (%)</Label>
                  <Input
                    id="edit-asset-ter"
                    type="number"
                    step="0.01"
                    min="0"
                    max="5"
                    placeholder="bijv. 0,20"
                    value={form.ter}
                    onChange={(e) => setForm((p) => ({ ...p, ter: e.target.value }))}
                    className="num"
                  />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Voer hier de jaarlijkse lopende kosten in (TER). Dit percentage is te vinden in de documentatie van het fonds. Voorbeeld: 0,20% voor een wereldwijd indexfonds.
                  </p>
                </div>
              )}
            </>
          )}

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annuleren
            </Button>
            <Button type="submit" disabled={updateAsset.isPending}>
              {updateAsset.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Opslaan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
