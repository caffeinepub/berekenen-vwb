import { useCallback, useState } from "react";

const COMMODITY_TICKERS_KEY = "vwb_commodity_tickers";

function getCommodityTickersFromStorage(): Set<string> {
  try {
    const raw = localStorage.getItem(COMMODITY_TICKERS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveCommodityTickers(tickers: Set<string>): void {
  localStorage.setItem(
    COMMODITY_TICKERS_KEY,
    JSON.stringify(Array.from(tickers)),
  );
}

export function useCommodities() {
  const [commodityTickers, setCommodityTickers] = useState<Set<string>>(
    getCommodityTickersFromStorage,
  );

  const addCommodityTicker = useCallback((ticker: string) => {
    setCommodityTickers((prev) => {
      const next = new Set(prev);
      next.add(ticker.toUpperCase());
      saveCommodityTickers(next);
      return next;
    });
  }, []);

  const removeCommodityTicker = useCallback((ticker: string) => {
    setCommodityTickers((prev) => {
      const next = new Set(prev);
      next.delete(ticker.toUpperCase());
      saveCommodityTickers(next);
      return next;
    });
  }, []);

  const isCommodity = useCallback(
    (ticker: string) => commodityTickers.has(ticker.toUpperCase()),
    [commodityTickers],
  );

  return {
    commodityTickers,
    addCommodityTicker,
    removeCommodityTicker,
    isCommodity,
  };
}
