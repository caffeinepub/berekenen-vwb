import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";
import { AlertCircle, Loader2, Plus, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AssetType } from "../backend.d";
import { useAddAsset } from "../hooks/useQueries";
import {
  type CryptoSearchResult,
  type StockSearchResult,
  fetchCryptoPrice,
  fetchStockPrice,
  searchCrypto,
  searchStocks,
} from "../utils/api";
import { setEtfFlag } from "../utils/ter";

// Internal form asset type: includes "etf" as a distinct UI option
type FormAssetType = "stock" | "crypto" | "etf";

interface AddAssetDialogProps {
  children?: React.ReactNode;
  updateOngoingCosts?: (ticker: string, enabled: boolean) => void;
  updateTer?: (ticker: string, pct: number | null) => void;
  /** If set, the type select is hidden and the asset type is locked to this value */
  forcedAssetType?: "stock" | "crypto";
  /** If set, only these types are shown in the select dropdown (for the Aandelen tab) */
  allowedAssetTypes?: Array<"stock" | "etf">;
  /** Twelve Data API key (required for stock/ETF/commodity search) */
  apiKey?: string;
}

function getInitialAssetType(
  forcedAssetType?: "stock" | "crypto",
  allowedAssetTypes?: Array<"stock" | "etf">,
): FormAssetType {
  if (forcedAssetType) return forcedAssetType;
  if (allowedAssetTypes && allowedAssetTypes.length > 0)
    return allowedAssetTypes[0];
  return "stock";
}

export function AddAssetDialog({
  children,
  updateOngoingCosts,
  updateTer,
  forcedAssetType,
  allowedAssetTypes,
  apiKey = "",
}: AddAssetDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => ({
    name: "",
    ticker: "",
    assetType: getInitialAssetType(
      forcedAssetType,
      allowedAssetTypes,
    ) as FormAssetType,
    currentPrice: "",
    hasOngoingCosts: false,
    ter: "",
  }));

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [stockResults, setStockResults] = useState<StockSearchResult[]>([]);
  const [cryptoResults, setCryptoResults] = useState<CryptoSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [priceError, setPriceError] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addAsset = useAddAsset();

  const isCrypto = form.assetType === "crypto" || forcedAssetType === "crypto";
  const isStockTab = !isCrypto; // stock or ETF

  // Map form's "etf" type to the backend AssetType.stock
  const backendAssetType = (ft: FormAssetType): AssetType =>
    ft === "crypto" ? AssetType.crypto : AssetType.stock;

  // Show ongoing-costs section only for ETF (not for Aandeel or crypto)
  const showOngoingCosts = form.assetType === "etf";

  // Whether to show the type select at all
  const showTypeSelect = !forcedAssetType;

  // Clear search when dialog closes or type changes
  const clearSearch = () => {
    setSearchQuery("");
    setStockResults([]);
    setCryptoResults([]);
    setIsSearching(false);
    setPriceError(false);
    setNoResults(false);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
  };

  // Debounced search effect
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (searchQuery.length < 2) {
      setStockResults([]);
      setCryptoResults([]);
      setIsSearching(false);
      setNoResults(false);
      return;
    }

    setIsSearching(true);
    setNoResults(false);

    searchTimeoutRef.current = setTimeout(async () => {
      if (isCrypto) {
        const results = await searchCrypto(searchQuery);
        setCryptoResults(results.slice(0, 10));
        setNoResults(results.length === 0);
      } else {
        if (!apiKey.trim()) {
          setIsSearching(false);
          return;
        }
        const results = await searchStocks(searchQuery, apiKey);
        setStockResults(results.slice(0, 10));
        setNoResults(results.length === 0);
      }
      setIsSearching(false);
    }, 500);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, isCrypto, apiKey]);

  const handleSelectStock = async (result: StockSearchResult) => {
    clearSearch();
    // Determine asset type from instrument_type field
    const detectedType: FormAssetType =
      result.instrument_type?.toLowerCase() === "etf" ? "etf" : "stock";
    setForm((p) => ({
      ...p,
      name: result.instrument_name,
      ticker: result.symbol,
      assetType: detectedType,
      // Clear TER/ongoing costs when type changes
      hasOngoingCosts: false,
      ter: "",
    }));
    // Persist MIC code so usePriceRefresh can use it later
    if (result.mic_code) {
      localStorage.setItem(`vwb_mic_code_${result.symbol}`, result.mic_code);
    }
    // Fetch price using MIC code for correct symbol building
    if (apiKey.trim()) {
      setIsFetchingPrice(true);
      setPriceError(false);
      const price = await fetchStockPrice(
        result.symbol,
        apiKey,
        result.currency,
        result.mic_code || result.exchange,
      );
      setIsFetchingPrice(false);
      if (price !== null) {
        setForm((p) => ({ ...p, currentPrice: String(price) }));
      } else {
        setPriceError(true);
      }
    }
  };

  const handleSelectCrypto = async (result: CryptoSearchResult) => {
    clearSearch();
    setForm((p) => ({
      ...p,
      name: result.name,
      ticker: result.symbol.toUpperCase(),
    }));
    // Store CoinGecko id for future price refreshes
    localStorage.setItem(
      `vwb_coingecko_id_${result.symbol.toUpperCase()}`,
      result.id,
    );
    // Fetch price
    setIsFetchingPrice(true);
    setPriceError(false);
    const price = await fetchCryptoPrice(result.id);
    setIsFetchingPrice(false);
    if (price !== null) {
      setForm((p) => ({ ...p, currentPrice: String(price) }));
    } else {
      setPriceError(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim() || !form.ticker.trim()) {
      toast.error("Naam en ticker zijn verplicht");
      return;
    }

    try {
      const rawPrice = form.currentPrice.toString().trim().replace(",", ".");
      const currentPrice = rawPrice !== "" ? Number.parseFloat(rawPrice) : 0;
      const normalizedTicker = form.ticker.trim().toUpperCase();
      await addAsset.mutateAsync({
        name: form.name.trim(),
        ticker: normalizedTicker,
        assetType: backendAssetType(form.assetType),
        currentPrice:
          Number.isNaN(currentPrice) || currentPrice < 0 ? 0 : currentPrice,
      });

      // Persist ETF flag so the app remembers this is an ETF (not a regular stock)
      setEtfFlag(normalizedTicker, form.assetType === "etf");

      if (updateOngoingCosts) {
        updateOngoingCosts(normalizedTicker, form.hasOngoingCosts);
      }
      if (form.hasOngoingCosts && form.ter && updateTer) {
        const terPct = Number.parseFloat(form.ter.replace(",", "."));
        if (!Number.isNaN(terPct) && terPct >= 0) {
          updateTer(normalizedTicker, terPct);
        }
      }

      toast.success(`${form.ticker.toUpperCase()} toegevoegd`);
      // Reset form but preserve forced/allowed type context
      setForm({
        name: "",
        ticker: "",
        assetType: getInitialAssetType(forcedAssetType, allowedAssetTypes),
        currentPrice: "",
        hasOngoingCosts: false,
        ter: "",
      });
      clearSearch();
      setOpen(false);
    } catch {
      toast.error("Fout bij het toevoegen van asset");
    }
  };

  const typeLabel = (t: FormAssetType) => {
    if (t === "etf") return "ETF";
    if (t === "crypto") return "Crypto";
    return "Aandeel";
  };

  const showResults = stockResults.length > 0 || cryptoResults.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) clearSearch();
        setOpen(v);
      }}
    >
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
          <DialogTitle className="font-semibold">
            Nieuwe asset toevoegen
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          {/* ── Search field ── */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="asset-search">
              Zoeken {isCrypto ? "(naam of ticker)" : "(naam of ticker)"}
            </Label>
            {isStockTab && !apiKey.trim() ? (
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2.5">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                <span>
                  Voer eerst je Twelve Data API-sleutel in via{" "}
                  <span className="font-medium text-foreground">
                    Instellingen
                  </span>{" "}
                  om te kunnen zoeken.
                </span>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  id="asset-search"
                  placeholder={
                    isCrypto ? "bijv. Bitcoin of BTC…" : "bijv. ASML of Apple…"
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                  autoComplete="off"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground animate-spin" />
                )}
              </div>
            )}

            {/* Search results dropdown */}
            {showResults && (
              <div className="border border-border rounded-md bg-popover shadow-md overflow-hidden max-h-[200px] overflow-y-auto">
                {isCrypto
                  ? cryptoResults.map((coin) => (
                      <button
                        key={coin.id}
                        type="button"
                        onClick={() => handleSelectCrypto(coin)}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm hover:bg-accent/60 transition-colors",
                          "flex items-center gap-2 border-b border-border/50 last:border-0",
                        )}
                      >
                        {coin.thumb && (
                          <img
                            src={coin.thumb}
                            alt=""
                            className="w-5 h-5 rounded-full shrink-0"
                          />
                        )}
                        <span className="font-medium">{coin.name}</span>
                        <span className="text-muted-foreground text-xs">
                          ({coin.symbol.toUpperCase()})
                        </span>
                        {coin.market_cap_rank && (
                          <span className="ml-auto text-xs text-muted-foreground/60">
                            #{coin.market_cap_rank}
                          </span>
                        )}
                      </button>
                    ))
                  : stockResults.map((stock) => (
                      <button
                        key={`${stock.symbol}-${stock.mic_code || stock.exchange}`}
                        type="button"
                        onClick={() => handleSelectStock(stock)}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm hover:bg-accent/60 transition-colors",
                          "flex items-center gap-2 border-b border-border/50 last:border-0",
                        )}
                      >
                        <span className="font-mono font-semibold text-xs text-primary min-w-[50px]">
                          {stock.symbol}
                        </span>
                        <span className="flex-1 truncate">
                          {stock.instrument_name}
                        </span>
                        <span className="text-xs text-muted-foreground/80 shrink-0 font-mono">
                          {stock.mic_code || stock.exchange}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {stock.instrument_type === "ETF" ? "ETF" : "Aandeel"}
                        </span>
                      </button>
                    ))}
              </div>
            )}

            {/* No results */}
            {noResults && !isSearching && searchQuery.length >= 2 && (
              <p className="text-xs text-muted-foreground">
                Geen resultaten gevonden. Controleer de naam of ticker en
                probeer opnieuw.
              </p>
            )}
          </div>

          {/* ── Price fetch status ── */}
          {isFetchingPrice && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Koers ophalen…
            </div>
          )}
          {priceError && (
            <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Koers kon niet worden opgehaald. Vul de prijs handmatig in.
            </div>
          )}

          {/* ── Name field ── */}
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

          {/* ── Ticker field ── */}
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

          {/* ── Type select ── */}
          {showTypeSelect ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="asset-type">Type</Label>
              <Select
                value={form.assetType}
                onValueChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    assetType: v as FormAssetType,
                    hasOngoingCosts: false,
                    ter: "",
                  }))
                }
              >
                <SelectTrigger id="asset-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedAssetTypes ? (
                    allowedAssetTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {typeLabel(t)}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="stock">Aandeel</SelectItem>
                      <SelectItem value="crypto">Crypto</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <div className="h-9 px-3 rounded-md border border-input bg-muted/40 flex items-center text-sm text-muted-foreground">
                {typeLabel(
                  (forcedAssetType as FormAssetType) ?? form.assetType,
                )}
              </div>
            </div>
          )}

          {/* ── Current price ── */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="asset-current-price">Huidige waarde (€)</Label>
            <Input
              id="asset-current-price"
              type="number"
              step="0.000001"
              min="0"
              placeholder="bijv. 125,50"
              value={form.currentPrice}
              onChange={(e) =>
                setForm((p) => ({ ...p, currentPrice: e.target.value }))
              }
              className="num"
            />
          </div>

          {/* ── Ongoing costs (stocks/ETFs only) ── */}
          {showOngoingCosts && (
            <>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
                  <Checkbox
                    id="asset-ongoing-costs"
                    checked={form.hasOngoingCosts}
                    onCheckedChange={(checked) =>
                      setForm((p) => ({
                        ...p,
                        hasOngoingCosts: checked === true,
                      }))
                    }
                    className="mt-0.5"
                  />
                  <div className="flex flex-col gap-0.5">
                    <Label
                      htmlFor="asset-ongoing-costs"
                      className="cursor-pointer font-medium text-sm"
                    >
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
                  <Label htmlFor="asset-ter">TER – lopende kosten (%)</Label>
                  <Input
                    id="asset-ter"
                    type="number"
                    step="0.01"
                    min="0"
                    max="5"
                    placeholder="bijv. 0,20"
                    value={form.ter}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, ter: e.target.value }))
                    }
                    className="num"
                  />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Voer hier de jaarlijkse lopende kosten in (TER). Dit
                    percentage is te vinden in de documentatie van het fonds.
                    Voorbeeld: 0,20% voor een wereldwijd indexfonds.
                  </p>
                </div>
              )}
            </>
          )}

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                clearSearch();
                setOpen(false);
              }}
            >
              Annuleren
            </Button>
            <Button
              type="submit"
              disabled={addAsset.isPending || isFetchingPrice}
            >
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
