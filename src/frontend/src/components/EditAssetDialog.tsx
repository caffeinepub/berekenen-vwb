import { useState } from "react";
import { toast } from "sonner";
import { AssetView, AssetType } from "../backend.d";
import { useUpdateAsset } from "../hooks/useQueries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface EditAssetDialogProps {
  asset: AssetView;
  children?: React.ReactNode;
}

export function EditAssetDialog({ asset, children }: EditAssetDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: asset.name,
    assetType: asset.assetType,
    currentPrice: String(asset.currentPrice),
  });
  const updateAsset = useUpdateAsset();

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setForm({
        name: asset.name,
        assetType: asset.assetType,
        currentPrice: String(asset.currentPrice),
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

    try {
      await updateAsset.mutateAsync({
        ticker: asset.ticker,
        name: form.name.trim(),
        assetType: form.assetType,
        currentPrice: isNaN(price) ? 0 : price,
      });
      toast.success(`${asset.ticker} bijgewerkt`);
      setOpen(false);
    } catch {
      toast.error("Fout bij het bijwerken van asset");
    }
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-asset-type">Type</Label>
            <Select
              value={form.assetType}
              onValueChange={(v) =>
                setForm((p) => ({ ...p, assetType: v as AssetType }))
              }
            >
              <SelectTrigger id="edit-asset-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AssetType.stock}>Aandeel</SelectItem>
                <SelectItem value={AssetType.crypto}>Crypto</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
