import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AssetType, type AssetView, type LoanView } from "../backend.d";
import { useActor } from "../hooks/useActor";
import { useCommodities } from "../hooks/useCommodities";
import { usePriceRefresh } from "../hooks/usePriceRefresh";
import { useAllAssets, useAllLoans } from "../hooks/useQueries";
import { useSettings } from "../hooks/useSettings";
import { useTer } from "../hooks/useTer";

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
  const [isActorReady, setIsActorReady] = useState(false);

  const { data: assets = [], isLoading, refetch, isFetching } = useAllAssets();
  const { data: loans = [] } = useAllLoans();
  const { terMap, updateTer, ongoingCostsMap, updateOngoingCosts } = useTer();
  const { commodityTickers, addCommodityTicker, removeCommodityTicker } =
    useCommodities();
  const { twelveDataApiKey, setTwelveDataApiKey } = useSettings();
  const { refreshPrices } = usePriceRefresh();
  const { actor, isFetching: isActorFetching } = useActor();

  // Actor is ready as soon as it exists — no extra backend call needed
  useEffect(() => {
    if (actor && !isActorFetching) {
      setIsActorReady(true);
    }
  }, [actor, isActorFetching]);

  // Load user name on mount / when actor becomes available
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

  const stockAssets = assets.filter(
    (a) => a.assetType === AssetType.stock && !commodityTickers.has(a.ticker),
  );
  const cryptoAssets = assets.filter((a) => a.assetType === AssetType.crypto);
  const commodityAssets = assets.filter(
    (a) => a.assetType === AssetType.stock && commodityTickers.has(a.ticker),
  );

  // Auto-refresh prices when switching tabs — intentionally omit asset/fn deps
  // so prices are fetched once per tab switch, not on every render.
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
