import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  ExternalLink,
  Info,
  KeyRound,
  Loader2,
  Palette,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAppContext } from "../context/AppContext";
import { THEME_OPTIONS, useTheme } from "../hooks/useTheme";

export function SettingsPage() {
  const { twelveDataApiKey, setTwelveDataApiKey, userName, setUserName } =
    useAppContext();
  const { theme, setTheme } = useTheme();

  const [inputValue, setInputValue] = useState(twelveDataApiKey);
  const [nameInput, setNameInput] = useState(userName);
  const [isSavingName, setIsSavingName] = useState(false);

  // Sync nameInput when userName loads from backend
  useEffect(() => {
    setNameInput(userName);
  }, [userName]);

  const handleSave = () => {
    setTwelveDataApiKey(inputValue.trim());
    toast.success("API-sleutel opgeslagen");
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setIsSavingName(true);
    try {
      await setUserName(trimmed);
      toast.success("Naam opgeslagen");
    } catch {
      toast.error("Naam opslaan mislukt. Probeer opnieuw.");
    } finally {
      setIsSavingName(false);
    }
  };

  const isSaved =
    twelveDataApiKey.trim().length > 0 &&
    inputValue.trim() === twelveDataApiKey.trim();

  const isNameSaved = nameInput.trim() === userName.trim();

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      {/* Profile card */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5">
            <User className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">Profiel</h2>
          </div>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Stel je naam in. Deze naam wordt getoond in de header van de app.
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-name-input">Naam</Label>
            <div className="flex gap-2">
              <Input
                id="profile-name-input"
                type="text"
                placeholder="Voer je naam in..."
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="text-sm"
              />
              <Button
                onClick={handleSaveName}
                disabled={
                  isNameSaved || nameInput.trim().length === 0 || isSavingName
                }
              >
                {isSavingName ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Opslaan...
                  </>
                ) : (
                  "Opslaan"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Theme card */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5">
            <Palette className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">Thema</h2>
          </div>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Kies de vormgeving van de app. De voorkeur wordt lokaal opgeslagen.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {THEME_OPTIONS.map((option) => {
              const isActive = theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  className={`flex items-start gap-3 rounded-lg border p-3.5 text-left transition-colors ${
                    isActive
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-accent/50"
                  }`}
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isActive ? "border-primary" : "border-muted-foreground"
                    }`}
                  >
                    {isActive && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span
                      className={`text-sm font-medium ${isActive ? "text-primary" : "text-foreground"}`}
                    >
                      {option.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

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
            Voer je persoonlijke API-sleutel in van Twelve Data. Deze wordt
            gebruikt voor koersopvragen bij{" "}
            <span className="text-foreground font-medium">Aandelen</span> en{" "}
            <span className="text-foreground font-medium">Grondstoffen</span>.
            Maak een gratis account aan via{" "}
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
              <Button
                onClick={handleSave}
                disabled={inputValue.trim() === twelveDataApiKey.trim()}
              >
                Opslaan
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md p-3">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/60" />
            <span>
              Voor Crypto via CoinGecko is geen API-sleutel nodig. Cryptokoersen
              worden automatisch opgehaald.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
