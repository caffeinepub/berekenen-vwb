import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { UserSettingsView } from "../backend.d";
import { useActor } from "./useActor";

// Debounce helper: returns a function that delays calling fn by `ms` milliseconds.
// Rapid successive calls cancel and restart the timer so only the last call fires.
function debounce<T extends unknown[]>(
  fn: (...args: T) => void,
  ms: number,
): (...args: T) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: T) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };
}

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

// Persistent migration flag — survives re-mounts (stored in module scope)
const MIGRATION_DONE_KEY = "vwb_migration_done_v1";
function isMigrationPersistentlyDone(): boolean {
  return localStorage.getItem(MIGRATION_DONE_KEY) === "1";
}
function markMigrationPersistentlyDone(): void {
  localStorage.setItem(MIGRATION_DONE_KEY, "1");
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useUserSettings() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  // One-time migration flag (also backed by localStorage so it survives re-mounts)
  const migrationDone = useRef(isMigrationPersistentlyDone());
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

  // ─── Backend query — simple stable key based on auth state ──────────────────
  // Using a simple "authenticated" key avoids key instability when the actor
  // object changes between renders while staying the same user session.
  const principalKey = actor ? "authenticated" : "anonymous";
  const { data: backendSettings, isLoading } = useQuery<UserSettingsView>({
    queryKey: ["userSettings", principalKey],
    queryFn: async () => {
      if (!actor) throw new Error("No actor");
      return actor.getUserSettings();
    },
    // Only fetch when we have a real authenticated actor (not anonymous)
    enabled: !!actor && principalKey !== "anonymous",
    staleTime: 60_000,
    gcTime: 300_000,
    retry: 1,
    retryDelay: 2000,
    // Never refetch on mount or window focus — settings don't change externally
    refetchOnWindowFocus: false,
    refetchOnMount: false,
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

    // One-time migration: if backend is empty but localStorage has data, push it up.
    // The flag is stored persistently in localStorage so the migration never runs twice.
    if (
      !hasBackendData(backendSettings) &&
      !migrationDone.current &&
      hasLocalData()
    ) {
      migrationDone.current = true;
      markMigrationPersistentlyDone();
      const localOngoing = mergeEtfFlags(readLocalOngoingCostsMap());
      const payload: UserSettingsView = {
        terEntries: Object.entries(readLocalTerMap()),
        twelveDataApiKey: readLocalApiKey(),
        commodityTickers: readLocalCommodityTickers(),
        ongoingCostsEntries: Object.entries(localOngoing),
      };
      // Only call saveMutation in the migration path
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
    // Skip re-applying if backend data hasn't changed since last apply — prevents
    // unnecessary state updates during a refetch storm triggered by useActor.ts
    const newTerMap = Object.fromEntries(backendSettings.terEntries);
    const newOngoingCostsMap = Object.fromEntries(
      backendSettings.ongoingCostsEntries,
    );
    const newCommodityTickers = backendSettings.commodityTickers;
    const newApiKey = backendSettings.twelveDataApiKey;

    if (backendApplied.current) {
      // Already applied once — only update if data meaningfully changed
      const currentSnapshot = JSON.stringify({
        terMap: terMapRef.current,
        ongoingCostsMap: ongoingCostsMapRef.current,
        commodityTickers: commodityTickersRef.current,
        twelveDataApiKey: twelveDataApiKeyRef.current,
      });
      const newSnapshot = JSON.stringify({
        terMap: newTerMap,
        ongoingCostsMap: newOngoingCostsMap,
        commodityTickers: newCommodityTickers,
        twelveDataApiKey: newApiKey,
      });
      if (currentSnapshot === newSnapshot) return;
    }

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

  // ─── Debounced save — batches rapid changes into a single backend write ──────
  // The ref keeps the debounced function stable across renders.
  const debouncedSaveRef = useRef(
    debounce((payload: UserSettingsView) => {
      saveMutation.mutate(payload);
    }, 300),
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
        debouncedSaveRef.current(buildPayload({ terMap: next }));
        return next;
      });
    },
    [buildPayload],
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
        debouncedSaveRef.current(buildPayload({ ongoingCostsMap: next }));
        return next;
      });
    },
    [buildPayload],
  );

  const updateCommodityTickers = useCallback(
    (tickers: string[]) => {
      setCommodityTickers(tickers);
      localStorage.setItem(COMMODITY_TICKERS_KEY, JSON.stringify(tickers));
      debouncedSaveRef.current(buildPayload({ commodityTickers: tickers }));
    },
    [buildPayload],
  );

  const updateTwelveDataApiKey = useCallback(
    (key: string) => {
      setTwelveDataApiKeyState(key);
      localStorage.setItem(API_KEY_STORAGE, key);
      debouncedSaveRef.current(buildPayload({ twelveDataApiKey: key }));
    },
    [buildPayload],
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
