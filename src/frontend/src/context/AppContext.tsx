import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AssetType, type AssetView, type LoanView } from "../backend.d";
import { useActor } from "../hooks/useActor";
import { usePriceRefresh } from "../hooks/usePriceRefresh";
import { useAllAssets, useAllLoans } from "../hooks/useQueries";
import { useUserSettings } from "../hooks/useUserSettings";

export type Section =
  | "dashboard"
  | "stocks"
  | "crypto"
  | "commodities"
  | "loans"
  | "yearoverview"
  | "settings";

interface AppContextValue {
  // Navigation
  activeSection: Section;
  setActiveSection: (s: Section) => void;

  // Actor readiness
  isActorReady: boolean;

  // Data
  assets: AssetView[];
  loans: LoanView[];
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => void;

  // Filtered assets per section
  stockAssets: AssetView[];
  cryptoAssets: AssetView[];
  commodityAssets: AssetView[];

  // TER / ongoing costs
  terMap: Record<string, number>;
  updateTer: (ticker: string, pct: number | null) => void;
  ongoingCostsMap: Record<string, boolean>;
  updateOngoingCosts: (ticker: string, enabled: boolean) => void;

  // Commodities
  commodityTickers: Set<string>;
  addCommodityTicker: (ticker: string) => void;
  removeCommodityTicker: (ticker: string) => void;

  // Settings
  twelveDataApiKey: string;
  setTwelveDataApiKey: (key: string) => void;

  // User profile
  userName: string;
  setUserName: (name: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [userName, setUserNameState] = useState<string>("");

  const { data: assets = [], isLoading, refetch, isFetching } = useAllAssets();
  const { data: loans = [] } = useAllLoans();
  const { refreshPrices } = usePriceRefresh();
  const { actor, isFetching: isActorFetching } = useActor();

  // ─── User settings — now backed by the canister ──────────────────────────
  const {
    terMap,
    ongoingCostsMap,
    commodityTickers: commodityTickersArray,
    twelveDataApiKey,
    updateTerMap,
    updateOngoingCostsMap,
    updateCommodityTickers,
    updateTwelveDataApiKey,
  } = useUserSettings();

  // Convert array → Set for downstream consumers (memoized to avoid recreation)
  const commodityTickers = useMemo(
    () => new Set(commodityTickersArray.map((t) => t.toUpperCase())),
    [commodityTickersArray],
  );

  // ─── Actor readiness — derived, not state ─────────────────────────────────
  const isActorReady = !!actor && !isActorFetching;

  // ─── User name ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!actor) return;
    actor
      .getUserName()
      .then((name) => {
        if (name) setUserNameState(name);
      })
      .catch(() => {
        // Silently ignore — name is optional
      });
  }, [actor]);

  const setUserName = useCallback(
    async (name: string) => {
      if (!actor) throw new Error("Niet verbonden met backend");
      await actor.setUserName(name);
      setUserNameState(name);
    },
    [actor],
  );

  // ─── Filtered assets per section (memoized) ───────────────────────────────
  const stockAssets = useMemo(
    () =>
      assets.filter(
        (a) =>
          a.assetType === AssetType.stock && !commodityTickers.has(a.ticker),
      ),
    [assets, commodityTickers],
  );
  const cryptoAssets = useMemo(
    () => assets.filter((a) => a.assetType === AssetType.crypto),
    [assets],
  );
  const commodityAssets = useMemo(
    () =>
      assets.filter(
        (a) =>
          a.assetType === AssetType.stock && commodityTickers.has(a.ticker),
      ),
    [assets, commodityTickers],
  );

  // ─── Wrapped update functions (matching original API surface) ─────────────
  const updateTer = useCallback(
    (ticker: string, pct: number | null) => updateTerMap(ticker, pct),
    [updateTerMap],
  );

  const updateOngoingCosts = useCallback(
    (ticker: string, enabled: boolean) =>
      updateOngoingCostsMap(ticker, enabled),
    [updateOngoingCostsMap],
  );

  const addCommodityTicker = useCallback(
    (ticker: string) => {
      const upper = ticker.toUpperCase();
      const next = Array.from(new Set([...commodityTickersArray, upper]));
      updateCommodityTickers(next);
    },
    [commodityTickersArray, updateCommodityTickers],
  );

  const removeCommodityTicker = useCallback(
    (ticker: string) => {
      const upper = ticker.toUpperCase();
      const next = commodityTickersArray.filter((t) => t !== upper);
      updateCommodityTickers(next);
    },
    [commodityTickersArray, updateCommodityTickers],
  );

  const setTwelveDataApiKey = useCallback(
    (key: string) => updateTwelveDataApiKey(key),
    [updateTwelveDataApiKey],
  );

  // ─── Auto-refresh prices on tab switch ────────────────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional tab-switch trigger only
  useEffect(() => {
    if (activeSection === "stocks" && stockAssets.length > 0) {
      refreshPrices(stockAssets, "stocks");
    } else if (activeSection === "crypto" && cryptoAssets.length > 0) {
      refreshPrices(cryptoAssets, "crypto");
    }
  }, [activeSection]);

  return (
    <AppContext.Provider
      value={{
        activeSection,
        setActiveSection,
        isActorReady,
        assets,
        loans,
        isLoading,
        isFetching,
        refetch,
        stockAssets,
        cryptoAssets,
        commodityAssets,
        terMap,
        updateTer,
        ongoingCostsMap,
        updateOngoingCosts,
        commodityTickers,
        addCommodityTicker,
        removeCommodityTicker,
        twelveDataApiKey,
        setTwelveDataApiKey,
        userName,
        setUserName,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
