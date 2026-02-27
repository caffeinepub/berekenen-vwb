import { useState } from "react";
import { toast } from "sonner";
import { useSettings } from "../hooks/useSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, ExternalLink, KeyRound, Info } from "lucide-react";

export function SettingsPage() {
  const { twelveDataApiKey, setTwelveDataApiKey } = useSettings();
  const [inputValue, setInputValue] = useState(twelveDataApiKey);

  const handleSave = () => {
    setTwelveDataApiKey(inputValue.trim());
    toast.success("API-sleutel opgeslagen");
  };

  const isSaved = twelveDataApiKey.trim().length > 0 && inputValue.trim() === twelveDataApiKey.trim();

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      {/* Twelve Data API card */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">Twelve Data API</h2>
            {isSaved && (
              <span className="flex items-center gap-1 text-xs text-gain font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Opgeslagen
              </span>
            )}
          </div>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Voer je persoonlijke API-sleutel in van Twelve Data. Deze wordt gebruikt voor
            koersopvragen bij{" "}
            <span className="text-foreground font-medium">Aandelen</span> en{" "}
            <span className="text-foreground font-medium">Grondstoffen</span>. Maak een gratis
            account aan via{" "}
            <a
              href="https://twelvedata.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
            >
              twelvedata.com
              <ExternalLink className="w-3 h-3" />
            </a>
            .
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="api-key-input">API-sleutel</Label>
            <div className="flex gap-2">
              <Input
                id="api-key-input"
                type="text"
                placeholder="Voer je API-sleutel in..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="font-mono text-sm"
              />
              <Button onClick={handleSave} disabled={inputValue.trim() === twelveDataApiKey.trim()}>
                Opslaan
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md p-3">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/60" />
            <span>
              Voor Crypto via CoinGecko is geen API-sleutel nodig. Cryptokoersen worden
              automatisch opgehaald.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
