import { useState } from "react";
import { toast } from "sonner";
import { AssetType } from "../backend.d";
import { useAddAsset } from "../hooks/useQueries";
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
import { Loader2, Plus } from "lucide-react";

interface AddAssetDialogProps {
  children?: React.ReactNode;
}

const INITIAL_FORM = {
  name: "",
  ticker: "",
  assetType: AssetType.stock as AssetType,
};

export function AddAssetDialog({ children }: AddAssetDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const addAsset = useAddAsset();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim() || !form.ticker.trim()) {
      toast.error("Naam en ticker zijn verplicht");
      return;
    }

    try {
      await addAsset.mutateAsync({
        name: form.name.trim(),
        ticker: form.ticker.trim().toUpperCase(),
        assetType: form.assetType,
        currentPrice: 0,
      });
      toast.success(`${form.ticker.toUpperCase()} toegevoegd`);
      setForm(INITIAL_FORM);
      setOpen(false);
    } catch {
      toast.error("Fout bij het toevoegen van asset");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            Asset toevoegen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-semibold">Nieuwe asset toevoegen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="asset-name">
              Naam <span className="text-loss">*</span>
            </Label>
            <Input
              id="asset-name"
              placeholder="bijv. Apple Inc."
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="asset-ticker">
              Ticker <span className="text-loss">*</span>
            </Label>
            <Input
              id="asset-ticker"
              placeholder="bijv. AAPL"
              value={form.ticker}
              onChange={(e) =>
                setForm((p) => ({ ...p, ticker: e.target.value.toUpperCase() }))
              }
              className="font-mono uppercase"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="asset-type">Type</Label>
            <Select
              value={form.assetType}
              onValueChange={(v) =>
                setForm((p) => ({ ...p, assetType: v as AssetType }))
              }
            >
              <SelectTrigger id="asset-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AssetType.stock}>Aandeel</SelectItem>
                <SelectItem value={AssetType.crypto}>Crypto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annuleren
            </Button>
            <Button type="submit" disabled={addAsset.isPending}>
              {addAsset.isPending && (
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
