import { useCallback, useRef } from "react";
import { toast } from "sonner";
import type { AssetView } from "../backend.d";
import {
  fetchCryptoPrice,
  fetchStockPrice,
  resolveCoinGeckoId,
} from "../utils/api";
import { useUpdateAssetPrice } from "./useQueries";

const STORAGE_KEY_API = "vwb_twelve_data_api_key";

export function usePriceRefresh() {
  const updateAssetPrice = useUpdateAssetPrice();
  // Track the last refresh timestamp per section to avoid double-refresh
  const lastRefreshedRef = useRef<Record<string, number>>({});

  const refreshPrices = useCallback(
    async (assets: AssetView[], section: "stocks" | "crypto") => {
      // Debounce: skip if refreshed in last 10 seconds for same section
      const now = Date.now();
      if (now - (lastRefreshedRef.current[section] ?? 0) < 10_000) return;
      lastRefreshedRef.current[section] = now;

      if (assets.length === 0) return;

      const apiKey = localStorage.getItem(STORAGE_KEY_API) ?? "";

      if (section === "stocks" && !apiKey.trim()) {
        // No API key — silently skip (user can see warning in settings)
        return;
      }

      const failedAssets: string[] = [];

      await Promise.all(
        assets.map(async (asset) => {
          try {
            let price: number | null = null;

            if (section === "stocks") {
              // Retrieve the MIC code stored when the user selected this stock
              const micCode =
                localStorage.getItem(`vwb_mic_code_${asset.ticker}`) ??
                undefined;
              price = await fetchStockPrice(
                asset.ticker,
                apiKey,
                undefined,
                micCode,
              );
            } else if (section === "crypto") {
              // Resolve CoinGecko ID: checks localStorage cache first, then
              // automatically searches CoinGecko if not found (handles new sessions
              // or different devices where localStorage is empty)
              const coinId = await resolveCoinGeckoId(asset.ticker, asset.name);
              if (coinId) {
                price = await fetchCryptoPrice(coinId);
              }
            }

            if (price !== null) {
              await updateAssetPrice.mutateAsync({
                ticker: asset.ticker,
                name: asset.name,
                assetType: asset.assetType,
                currentPrice: price,
              });
            } else {
              failedAssets.push(asset.ticker);
            }
          } catch {
            failedAssets.push(asset.ticker);
          }
        }),
      );

      if (failedAssets.length > 0) {
        toast.warning(
          `Koers kon niet worden opgehaald voor: ${failedAssets.join(", ")}. Controleer de verbinding of werk de prijs handmatig bij.`,
          { duration: 6000 },
        );
      }
    },
    [updateAssetPrice],
  );

  return { refreshPrices };
}
