import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { UserSettingsView } from "../backend.d";
import { useActor } from "./useActor";

// ─── localStorage keys (kept for cache/migration) ────────────────────────────
const TER_KEY = "vwb_ter_percentages";
const ONGOING_COSTS_KEY = "vwb_ongoing_costs_flags";
const COMMODITY_TICKERS_KEY = "vwb_commodity_tickers";
const API_KEY_STORAGE = "vwb_twelve_data_api_key";

// ─── localStorage helpers ─────────────────────────────────────────────────────
function readLocalTerMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(TER_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function readLocalOngoingCostsMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(ONGOING_COSTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function readLocalCommodityTickers(): string[] {
  try {
    const raw = localStorage.getItem(COMMODITY_TICKERS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function readLocalApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) ?? "";
}

function writeLocalSettings(settings: {
  terMap: Record<string, number>;
  ongoingCostsMap: Record<string, boolean>;
  commodityTickers: string[];
  twelveDataApiKey: string;
}) {
  localStorage.setItem(TER_KEY, JSON.stringify(settings.terMap));
  localStorage.setItem(
    ONGOING_COSTS_KEY,
    JSON.stringify(settings.ongoingCostsMap),
  );
  localStorage.setItem(
    COMMODITY_TICKERS_KEY,
    JSON.stringify(settings.commodityTickers),
  );
  localStorage.setItem(API_KEY_STORAGE, settings.twelveDataApiKey);
}

// ─── Helper: check if local storage has meaningful data ──────────────────────
function hasLocalData(): boolean {
  const terMap = readLocalTerMap();
  const ongoingCostsMap = readLocalOngoingCostsMap();
  const commodityTickers = readLocalCommodityTickers();
  const apiKey = readLocalApiKey();
  return (
    Object.keys(terMap).length > 0 ||
    Object.keys(ongoingCostsMap).length > 0 ||
    commodityTickers.length > 0 ||
    apiKey.length > 0
  );
}

function hasBackendData(settings: UserSettingsView): boolean {
  return (
    settings.terEntries.length > 0 ||
    settings.ongoingCostsEntries.length > 0 ||
    settings.commodityTickers.length > 0 ||
    settings.twelveDataApiKey.length > 0
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useUserSettings() {
  const { actor, isFetching: isActorFetching } = useActor();
  const queryClient = useQueryClient();
  const migrationDone = useRef(false);

  // Local state — initialized from localStorage as cache
  const [terMap, setTerMap] = useState<Record<string, number>>(readLocalTerMap);
  const [ongoingCostsMap, setOngoingCostsMap] = useState<
    Record<string, boolean>
  >(readLocalOngoingCostsMap);
  const [commodityTickers, setCommodityTickers] = useState<string[]>(
    readLocalCommodityTickers,
  );
  const [twelveDataApiKey, setTwelveDataApiKeyState] =
    useState<string>(readLocalApiKey);

  // ─── Fetch settings from backend ──────────────────────────────────────────
  const { data: backendSettings, isLoading } = useQuery<UserSettingsView>({
    queryKey: ["userSettings"],
    queryFn: async () => {
      if (!actor) {
        return {
          terEntries: [],
          twelveDataApiKey: "",
          commodityTickers: [],
          ongoingCostsEntries: [],
        };
      }
      return actor.getUserSettings();
    },
    enabled: !!actor && !isActorFetching,
    staleTime: 30_000,
  });

  // ─── Save mutation ─────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (settings: UserSettingsView) => {
      if (!actor) return;
      await actor.saveUserSettings(settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userSettings"] });
    },
  });

  // ─── Sync backend → local state + localStorage (and migrate if needed) ────
  // biome-ignore lint/correctness/useExhaustiveDependencies: saveMutation.mutate is stable; only backendSettings matters here
  useEffect(() => {
    if (!backendSettings) return;

    if (
      !hasBackendData(backendSettings) &&
      !migrationDone.current &&
      hasLocalData()
    ) {
      // One-time migration: push localStorage data up to backend
      migrationDone.current = true;
      const migrationPayload: UserSettingsView = {
        terEntries: Object.entries(readLocalTerMap()),
        twelveDataApiKey: readLocalApiKey(),
        commodityTickers: readLocalCommodityTickers(),
        ongoingCostsEntries: Object.entries(readLocalOngoingCostsMap()),
      };
      saveMutation.mutate(migrationPayload);
      // Apply migrated data to local state
      setTerMap(readLocalTerMap());
      setOngoingCostsMap(readLocalOngoingCostsMap());
      setCommodityTickers(readLocalCommodityTickers());
      setTwelveDataApiKeyState(readLocalApiKey());
    } else if (hasBackendData(backendSettings)) {
      // Backend has data — apply it to local state and cache to localStorage
      const newTerMap = Object.fromEntries(backendSettings.terEntries);
      const newOngoingCostsMap = Object.fromEntries(
        backendSettings.ongoingCostsEntries,
      );
      const newCommodityTickers = backendSettings.commodityTickers;
      const newApiKey = backendSettings.twelveDataApiKey;

      setTerMap(newTerMap);
      setOngoingCostsMap(newOngoingCostsMap);
      setCommodityTickers(newCommodityTickers);
      setTwelveDataApiKeyState(newApiKey);

      writeLocalSettings({
        terMap: newTerMap,
        ongoingCostsMap: newOngoingCostsMap,
        commodityTickers: newCommodityTickers,
        twelveDataApiKey: newApiKey,
      });
    }
  }, [backendSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Helper to build full settings payload ─────────────────────────────────
  const buildPayload = useCallback(
    (
      overrides: Partial<{
        terMap: Record<string, number>;
        ongoingCostsMap: Record<string, boolean>;
        commodityTickers: string[];
        twelveDataApiKey: string;
      }> = {},
    ): UserSettingsView => {
      const resolvedTerMap = overrides.terMap ?? terMap;
      const resolvedOngoingCostsMap =
        overrides.ongoingCostsMap ?? ongoingCostsMap;
      const resolvedCommodityTickers =
        overrides.commodityTickers ?? commodityTickers;
      const resolvedApiKey = overrides.twelveDataApiKey ?? twelveDataApiKey;
      return {
        terEntries: Object.entries(resolvedTerMap),
        ongoingCostsEntries: Object.entries(resolvedOngoingCostsMap),
        commodityTickers: resolvedCommodityTickers,
        twelveDataApiKey: resolvedApiKey,
      };
    },
    [terMap, ongoingCostsMap, commodityTickers, twelveDataApiKey],
  );

  // ─── Update functions ──────────────────────────────────────────────────────
  const updateTerMap = useCallback(
    (ticker: string, pct: number | null) => {
      setTerMap((prev) => {
        const next = { ...prev };
        if (pct === null || pct === undefined) {
          delete next[ticker];
        } else {
          next[ticker] = pct;
        }
        // Persist to localStorage
        localStorage.setItem(TER_KEY, JSON.stringify(next));
        // Save to backend
        saveMutation.mutate(buildPayload({ terMap: next }));
        return next;
      });
    },
    [buildPayload, saveMutation],
  );

  const updateOngoingCostsMap = useCallback(
    (ticker: string, enabled: boolean) => {
      setOngoingCostsMap((prev) => {
        const next = { ...prev };
        if (!enabled) {
          delete next[ticker];
        } else {
          next[ticker] = true;
        }
        // Persist to localStorage
        localStorage.setItem(ONGOING_COSTS_KEY, JSON.stringify(next));
        // Save to backend
        saveMutation.mutate(buildPayload({ ongoingCostsMap: next }));
        return next;
      });
    },
    [buildPayload, saveMutation],
  );

  const updateCommodityTickers = useCallback(
    (tickers: string[]) => {
      setCommodityTickers(tickers);
      // Persist to localStorage
      localStorage.setItem(COMMODITY_TICKERS_KEY, JSON.stringify(tickers));
      // Save to backend
      saveMutation.mutate(buildPayload({ commodityTickers: tickers }));
    },
    [buildPayload, saveMutation],
  );

  const updateTwelveDataApiKey = useCallback(
    (key: string) => {
      setTwelveDataApiKeyState(key);
      // Persist to localStorage
      localStorage.setItem(API_KEY_STORAGE, key);
      // Save to backend
      saveMutation.mutate(buildPayload({ twelveDataApiKey: key }));
    },
    [buildPayload, saveMutation],
  );

  return {
    // State
    terMap,
    ongoingCostsMap,
    commodityTickers,
    twelveDataApiKey,
    isLoading,

    // Updaters
    updateTerMap,
    updateOngoingCostsMap,
    updateCommodityTickers,
    updateTwelveDataApiKey,
  };
}
