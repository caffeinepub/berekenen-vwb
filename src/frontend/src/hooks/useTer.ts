import { useState, useCallback } from "react";
import { getTerPercentages, setTerPercentage, getTerPercentage } from "../utils/ter";

export function useTer() {
  const [terMap, setTerMap] = useState<Record<string, number>>(getTerPercentages);

  const updateTer = useCallback((ticker: string, pct: number | null) => {
    setTerPercentage(ticker, pct);
    setTerMap(getTerPercentages());
  }, []);

  return { terMap, updateTer, getTerForTicker: (t: string) => getTerPercentage(t) };
}
