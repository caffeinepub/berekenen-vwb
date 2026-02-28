import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { UserSettingsView } from "../backend.d";
import { useActor } from "./useActor";

// ─── localStorage keys (used only as write-through cache) ─────────────────────
const TER_KEY = "vwb_ter_percentages";
const ONGOING_COSTS_KEY = "vwb_ongoing_costs_flags";
const COMMODITY_TICKERS_KEY = "vwb_commodity_tickers";
const API_KEY_STORAGE = "vwb_twelve_data_api_key";
const ETF_FLAGS_KEY = "vwb_etf_flags";

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

// Migrate ETF flags from old localStorage key into ongoingCosts entries
function mergeEtfFlags(
  ongoingCostsMap: Record<string, boolean>,
): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(ETF_FLAGS_KEY);
    if (!raw) return ongoingCostsMap;
    const etfFlags: Record<string, boolean> = JSON.parse(raw);
    const merged = { ...ongoingCostsMap };
    for (const [ticker, isEtf] of Object.entries(etfFlags)) {
      if (isEtf && !(ticker in merged)) {
        merged[ticker] = true;
      }
    }
    return merged;
  } catch {
    return ongoingCostsMap;
  }
}

function writeLocalCache(settings: {
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

function hasLocalData(): boolean {
  return (
    Object.keys(readLocalTerMap()).length > 0 ||
    Object.keys(readLocalOngoingCostsMap()).length > 0 ||
    readLocalCommodityTickers().length > 0 ||
    readLocalApiKey().length > 0
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

  // One-time migration flag
  const migrationDone = useRef(false);
  // Track if we have applied backend data (to avoid applying empty backend data
  // over valid local state on first load)
  const backendApplied = useRef(false);

  // Local state — pre-seeded from localStorage as optimistic cache
  const [terMap, setTerMap] = useState<Record<string, number>>(readLocalTerMap);
  const [ongoingCostsMap, setOngoingCostsMap] = useState<
    Record<string, boolean>
  >(() => mergeEtfFlags(readLocalOngoingCostsMap()));
  const [commodityTickers, setCommodityTickers] = useState<string[]>(
    readLocalCommodityTickers,
  );
  const [twelveDataApiKey, setTwelveDataApiKeyState] =
    useState<string>(readLocalApiKey);

  // ─── Backend query — always re-fetch after actor changes ──────────────────
  // Use actor principal as part of queryKey so switching users forces a new fetch
  const actorPrincipal = actor ? "authenticated" : "anonymous";
  const { data: backendSettings, isLoading } = useQuery<UserSettingsView>({
    queryKey: ["userSettings", actorPrincipal],
    queryFn: async () => {
      if (!actor) throw new Error("No actor");
      return actor.getUserSettings();
    },
    enabled: !!actor && !isActorFetching,
    staleTime: 0, // Always treat as stale so it refetches after login
    gcTime: 0, // Don't cache between sessions
    retry: 3,
    retryDelay: 1000,
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

  // ─── Sync backend → local state ───────────────────────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: saveMutation.mutate is stable from useMutation; only re-run when backendSettings changes
  useEffect(() => {
    if (!backendSettings) return;

    // One-time migration: if backend is empty but localStorage has data, push it up
    if (
      !hasBackendData(backendSettings) &&
      !migrationDone.current &&
      hasLocalData()
    ) {
      migrationDone.current = true;
      const localOngoing = mergeEtfFlags(readLocalOngoingCostsMap());
      const payload: UserSettingsView = {
        terEntries: Object.entries(readLocalTerMap()),
        twelveDataApiKey: readLocalApiKey(),
        commodityTickers: readLocalCommodityTickers(),
        ongoingCostsEntries: Object.entries(localOngoing),
      };
      saveMutation.mutate(payload);
      // Apply local data to state
      setTerMap(readLocalTerMap());
      setOngoingCostsMap(localOngoing);
      setCommodityTickers(readLocalCommodityTickers());
      setTwelveDataApiKeyState(readLocalApiKey());
      backendApplied.current = true;
      return;
    }

    // Normal case: apply backend data (backend is always the source of truth after login)
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
    backendApplied.current = true;

    // Write-through to localStorage as cache for instant loading on next session
    writeLocalCache({
      terMap: newTerMap,
      ongoingCostsMap: newOngoingCostsMap,
      commodityTickers: newCommodityTickers,
      twelveDataApiKey: newApiKey,
    });
  }, [backendSettings]);

  // ─── Build full settings payload from current state ────────────────────────
  // Use refs to avoid stale closures in update callbacks
  const terMapRef = useRef(terMap);
  const ongoingCostsMapRef = useRef(ongoingCostsMap);
  const commodityTickersRef = useRef(commodityTickers);
  const twelveDataApiKeyRef = useRef(twelveDataApiKey);

  // Keep refs in sync
  useEffect(() => {
    terMapRef.current = terMap;
  }, [terMap]);
  useEffect(() => {
    ongoingCostsMapRef.current = ongoingCostsMap;
  }, [ongoingCostsMap]);
  useEffect(() => {
    commodityTickersRef.current = commodityTickers;
  }, [commodityTickers]);
  useEffect(() => {
    twelveDataApiKeyRef.current = twelveDataApiKey;
  }, [twelveDataApiKey]);

  const buildPayload = useCallback(
    (
      overrides: Partial<{
        terMap: Record<string, number>;
        ongoingCostsMap: Record<string, boolean>;
        commodityTickers: string[];
        twelveDataApiKey: string;
      }> = {},
    ): UserSettingsView => ({
      terEntries: Object.entries(overrides.terMap ?? terMapRef.current),
      ongoingCostsEntries: Object.entries(
        overrides.ongoingCostsMap ?? ongoingCostsMapRef.current,
      ),
      commodityTickers:
        overrides.commodityTickers ?? commodityTickersRef.current,
      twelveDataApiKey:
        overrides.twelveDataApiKey ?? twelveDataApiKeyRef.current,
    }),
    [],
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
        localStorage.setItem(TER_KEY, JSON.stringify(next));
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
        localStorage.setItem(ONGOING_COSTS_KEY, JSON.stringify(next));
        saveMutation.mutate(buildPayload({ ongoingCostsMap: next }));
        return next;
      });
    },
    [buildPayload, saveMutation],
  );

  const updateCommodityTickers = useCallback(
    (tickers: string[]) => {
      setCommodityTickers(tickers);
      localStorage.setItem(COMMODITY_TICKERS_KEY, JSON.stringify(tickers));
      saveMutation.mutate(buildPayload({ commodityTickers: tickers }));
    },
    [buildPayload, saveMutation],
  );

  const updateTwelveDataApiKey = useCallback(
    (key: string) => {
      setTwelveDataApiKeyState(key);
      localStorage.setItem(API_KEY_STORAGE, key);
      saveMutation.mutate(buildPayload({ twelveDataApiKey: key }));
    },
    [buildPayload, saveMutation],
  );

  return {
    terMap,
    ongoingCostsMap,
    commodityTickers,
    twelveDataApiKey,
    isLoading,
    updateTerMap,
    updateOngoingCostsMap,
    updateCommodityTickers,
    updateTwelveDataApiKey,
  };
}
