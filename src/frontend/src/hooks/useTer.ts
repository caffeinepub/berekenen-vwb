import { useState, useCallback } from "react";
import { getTerPercentages, setTerPercentage, getTerPercentage, getOngoingCostsFlags, setOngoingCostsFlag } from "../utils/ter";

export function useTer() {
  const [terMap, setTerMap] = useState<Record<string, number>>(getTerPercentages);
  const [ongoingCostsMap, setOngoingCostsMap] = useState<Record<string, boolean>>(getOngoingCostsFlags);

  const updateTer = useCallback((ticker: string, pct: number | null) => {
    setTerPercentage(ticker, pct);
    setTerMap(getTerPercentages());
  }, []);

  const updateOngoingCosts = useCallback((ticker: string, enabled: boolean) => {
    setOngoingCostsFlag(ticker, enabled);
    setOngoingCostsMap(getOngoingCostsFlags());
  }, []);

  return { terMap, updateTer, getTerForTicker: (t: string) => getTerPercentage(t), ongoingCostsMap, updateOngoingCosts };
}
