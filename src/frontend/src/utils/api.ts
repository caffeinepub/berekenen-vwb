// API utilities for Twelve Data and CoinGecko

const TWELVE_DATA_BASE = "https://api.twelvedata.com";
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

// Commodity symbol map
export const COMMODITY_SYMBOL_MAP: Record<string, string> = {
  "Goud": "XAU/EUR",
  "Zilver": "XAG/EUR",
  "Platinum": "XPT/EUR",
  "Palladium": "XPD/EUR",
  "Koper": "COPPER",
  "Olie (WTI)": "WTI/USD",
  "Olie (Brent)": "BRENT/USD",
  "Aardgas": "NATGAS",
  "Tarwe": "WHEAT",
  "Mais": "CORN",
  "Koffie": "COFFEE",
  "Cacao": "COCOA",
  "Suiker": "SUGAR",
};

// Commodities that are quoted in USD (need EUR conversion)
const USD_COMMODITY_SYMBOLS = new Set([
  "WTI/USD",
  "BRENT/USD",
  "NATGAS",
  "WHEAT",
  "CORN",
  "COFFEE",
  "COCOA",
  "SUGAR",
  "COPPER",
]);

/**
 * MIC codes for US exchanges — stocks on these use ticker only and need USD→EUR conversion.
 * Source: Twelve Data symbol_search returns mic_code field.
 */
const US_MIC_CODES = new Set([
  "XNGS", // Nasdaq Global Select
  "XNYS", // NYSE
  "XNAS", // Nasdaq
  "ARCX", // NYSE Arca
  "XASE", // NYSE American (AMEX)
  "BATS", // BATS
  "XOTC", // OTC
]);

/**
 * MIC codes for GBP-denominated exchanges — need GBP→EUR conversion.
 */
const GBP_MIC_CODES = new Set([
  "XLON", // London Stock Exchange
  "XDUB", // Irish Stock Exchange (also GBP/EUR denominated)
]);

/**
 * Build the correct price symbol for Twelve Data based on the MIC exchange code.
 * - US exchanges: use ticker only (e.g. AAPL)
 * - All other exchanges: use ticker:EXCHANGE (e.g. ASML:XAMS)
 */
export function buildPriceSymbol(ticker: string, micCode?: string): string {
  if (!micCode || US_MIC_CODES.has(micCode.toUpperCase())) {
    return ticker;
  }
  return `${ticker}:${micCode.toUpperCase()}`;
}

/**
 * Determine the currency for a given MIC exchange code.
 */
export function getCurrencyForExchange(micCode?: string): "EUR" | "USD" | "GBP" | "OTHER" {
  if (!micCode) return "USD"; // assume USD if unknown
  const mic = micCode.toUpperCase();
  if (US_MIC_CODES.has(mic)) return "USD";
  if (GBP_MIC_CODES.has(mic)) return "GBP";
  // European EUR exchanges
  const EUR_MIC_CODES = new Set(["XAMS", "XPAR", "XBRU", "XLIS", "XFRA", "XETR"]);
  if (EUR_MIC_CODES.has(mic)) return "EUR";
  return "OTHER";
}

export interface StockSearchResult {
  symbol: string;
  instrument_name: string;
  exchange: string;
  mic_code: string;
  exchange_timezone: string;
  instrument_type: string;
  country: string;
  currency: string;
}

export interface CryptoSearchResult {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number | null;
  thumb: string;
}

/**
 * Priority exchanges — results from these exchanges are shown first in search results.
 * Within each priority group the original API order is preserved.
 */
const PRIORITY_EXCHANGES = new Set([
  "XNAS", // Nasdaq Global Select Market
  "XNGS", // Nasdaq Global Market
  "XNYS", // New York Stock Exchange
  "ARCX", // NYSE Arca
  "BATS", // CBOE BZX (BATS)
  "XASE", // NYSE American (AMEX)
  "XNMS", // Nasdaq National Market
  "XNCM", // Nasdaq Capital Market
  "OTCQ", // OTC Markets (OTCQX / OTCQB)
  "PINX", // OTC Pink Sheets
]);

/**
 * Search for stocks and ETFs via Twelve Data.
 * We do NOT pass the `type` filter in the URL (it can cause API errors).
 * Instead we filter client-side on instrument_type.
 * Results are sorted so priority exchanges (US/major markets) appear first.
 */
export async function searchStocks(query: string, apiKey: string): Promise<StockSearchResult[]> {
  if (!query.trim() || !apiKey.trim()) return [];
  // outputsize=10 to limit results; no type= filter to avoid API issues
  const url = `${TWELVE_DATA_BASE}/symbol_search?symbol=${encodeURIComponent(query)}&outputsize=10&apikey=${apiKey}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const data: StockSearchResult[] = json.data ?? [];
    // Filter to only stocks and ETFs (client-side)
    const allowedTypes = [
      "common stock",
      "stock",
      "etf",
      "fund",
      "american depositary receipt",
      "depositary receipt",
    ];
    const filtered = data.filter((item) =>
      allowedTypes.some((t) => item.instrument_type?.toLowerCase().includes(t))
    );
    // Sort: priority exchanges first, others after — stable within each group
    return filtered.sort((a, b) => {
      const aPriority = PRIORITY_EXCHANGES.has((a.mic_code || a.exchange || "").toUpperCase()) ? 0 : 1;
      const bPriority = PRIORITY_EXCHANGES.has((b.mic_code || b.exchange || "").toUpperCase()) ? 0 : 1;
      return aPriority - bPriority;
    });
  } catch {
    return [];
  }
}

/**
 * Fetch the USD/EUR exchange rate from Twelve Data.
 */
async function fetchUsdEurRate(apiKey: string): Promise<number | null> {
  const url = `${TWELVE_DATA_BASE}/price?symbol=USD%2FEUR&apikey=${apiKey}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.price) {
      const p = parseFloat(json.price);
      return isNaN(p) ? null : p;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch the GBP/EUR exchange rate from Twelve Data.
 */
async function fetchGbpEurRate(apiKey: string): Promise<number | null> {
  const url = `${TWELVE_DATA_BASE}/price?symbol=GBP%2FEUR&apikey=${apiKey}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.price) {
      const p = parseFloat(json.price);
      return isNaN(p) ? null : p;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch the current price of a stock/ETF via Twelve Data.
 *
 * Uses the MIC exchange code (micCode) to:
 * 1. Build the correct price symbol (e.g. ASML:XAMS for European stocks)
 * 2. Determine the currency and apply the correct FX conversion to EUR
 *
 * US exchanges (XNGS, XNYS, XNAS, ARCX): use ticker only, convert USD→EUR
 * London Stock Exchange (XLON): use TICKER:XLON, convert GBP→EUR
 * European exchanges (XAMS, XPAR, etc.): use TICKER:EXCHANGE, no conversion needed
 *
 * @param ticker  - The raw ticker symbol (e.g. ASML)
 * @param apiKey  - Twelve Data API key
 * @param micCode - MIC exchange code from search result (e.g. XAMS, XNGS)
 */
export async function fetchStockPrice(
  ticker: string,
  apiKey: string,
  _deprecatedCurrency?: string,
  micCode?: string
): Promise<number | null> {
  if (!ticker || !apiKey) return null;

  // Build the correct symbol for this exchange
  const priceSymbol = buildPriceSymbol(ticker, micCode);

  const url = `${TWELVE_DATA_BASE}/price?symbol=${encodeURIComponent(priceSymbol)}&apikey=${apiKey}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();

    // Twelve Data returns { "code": 400, "message": "..." } on errors
    if (json.code || json.status === "error") return null;

    if (json.price) {
      const p = parseFloat(json.price);
      if (isNaN(p)) return null;

      const currency = getCurrencyForExchange(micCode);

      if (currency === "USD") {
        const usdEurRate = await fetchUsdEurRate(apiKey);
        if (usdEurRate !== null) {
          return Math.round(p * usdEurRate * 10000) / 10000;
        }
        return p; // fallback: return raw
      }

      if (currency === "GBP") {
        const gbpEurRate = await fetchGbpEurRate(apiKey);
        if (gbpEurRate !== null) {
          return Math.round(p * gbpEurRate * 10000) / 10000;
        }
        return p; // fallback: return raw
      }

      // EUR or unknown — return as-is
      return p;
    }
    return null;
  } catch {
    return null;
  }
}

export async function searchCrypto(query: string): Promise<CryptoSearchResult[]> {
  if (!query.trim()) return [];
  const url = `${COINGECKO_BASE}/search?query=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    return json.coins ?? [];
  } catch {
    return [];
  }
}

export async function fetchCryptoPrice(coinId: string): Promise<number | null> {
  if (!coinId) return null;
  const url = `${COINGECKO_BASE}/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=eur`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const price = json[coinId]?.eur;
    return typeof price === "number" ? price : null;
  } catch {
    return null;
  }
}

export async function fetchCommodityPrice(commodityName: string, apiKey: string): Promise<number | null> {
  const symbol = COMMODITY_SYMBOL_MAP[commodityName];
  if (!symbol || !apiKey) return null;
  const url = `${TWELVE_DATA_BASE}/price?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.price) {
      const p = parseFloat(json.price);
      if (isNaN(p)) return null;
      // Convert USD-denominated commodities to EUR
      if (USD_COMMODITY_SYMBOLS.has(symbol)) {
        const usdEurRate = await fetchUsdEurRate(apiKey);
        if (usdEurRate !== null) {
          return Math.round(p * usdEurRate * 100) / 100;
        }
      }
      return p;
    }
    return null;
  } catch {
    return null;
  }
}
