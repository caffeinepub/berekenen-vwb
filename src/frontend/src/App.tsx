import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Dashboard } from "./components/Dashboard";
import { PortfolioDashboard } from "./components/PortfolioDashboard";
import { AssetsList } from "./components/AssetsList";
import { YearOverview } from "./components/YearOverview";
import { LoansPage } from "./components/LoansPage";
import { SettingsPage } from "./components/SettingsPage";
import { AddAssetDialog } from "./components/AddAssetDialog";
import { AddCommodityAssetDialog } from "./components/AddCommodityAssetDialog";
import { useAllAssets, useAllLoans } from "./hooks/useQueries";
import { useTer } from "./hooks/useTer";
import { useCommodities } from "./hooks/useCommodities";
import { useSettings } from "./hooks/useSettings";
import { usePriceRefresh } from "./hooks/usePriceRefresh";
import { AssetType } from "./backend.d";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, RefreshCw, Coins, CalendarDays, Mountain, Handshake, Settings, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

type Section = "dashboard" | "stocks" | "crypto" | "commodities" | "yearoverview" | "loans" | "settings";

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard className="w-4 h-4" />,
  },
  {
    id: "stocks",
    label: "Aandelen",
    icon: <TrendingUp className="w-4 h-4" />,
  },
  {
    id: "crypto",
    label: "Crypto",
    icon: <Coins className="w-4 h-4" />,
  },
  {
    id: "commodities",
    label: "Grondstoffen",
    icon: <Mountain className="w-4 h-4" />,
  },
  {
    id: "loans",
    label: "Leningen",
    icon: <Handshake className="w-4 h-4" />,
  },
  {
    id: "yearoverview",
    label: "Jaaroverzicht",
    icon: <CalendarDays className="w-4 h-4" />,
  },
  {
    id: "settings",
    label: "Instellingen",
    icon: <Settings className="w-4 h-4" />,
  },
];

export default function App() {
  const { data: assets = [], isLoading, refetch, isFetching } = useAllAssets();
  const { data: loans = [] } = useAllLoans();
  const { terMap, updateTer, ongoingCostsMap, updateOngoingCosts } = useTer();
  const { commodityTickers } = useCommodities();
  const { twelveDataApiKey } = useSettings();
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const { refreshPrices } = usePriceRefresh();

  // Filter for stocks: assetType === stock AND not a commodity
  const stockAssets = assets.filter(
    (a) => a.assetType === AssetType.stock && !commodityTickers.has(a.ticker)
  );

  // Filter for crypto
  const cryptoAssets = assets.filter((a) => a.assetType === AssetType.crypto);

  // Filter for commodities: assetType === stock AND is a commodity
  const commodityAssets = assets.filter(
    (a) => a.assetType === AssetType.stock && commodityTickers.has(a.ticker)
  );

  // Refresh prices when switching to the stocks or crypto tab
  useEffect(() => {
    if (activeSection === "stocks" && stockAssets.length > 0) {
      refreshPrices(stockAssets, "stocks");
    } else if (activeSection === "crypto" && cryptoAssets.length > 0) {
      refreshPrices(cryptoAssets, "crypto");
    }
  }, [activeSection]); // only re-run when tab changes

  const filteredAssets =
    activeSection === "stocks"
      ? stockAssets
      : activeSection === "crypto"
        ? cryptoAssets
        : activeSection === "commodities"
          ? commodityAssets
          : assets; // yearoverview shows all

  const isYearOverview = activeSection === "yearoverview";
  const isLoans = activeSection === "loans";
  const isCommodities = activeSection === "commodities";
  const isSettings = activeSection === "settings";

  const sectionIcon =
    activeSection === "stocks" ? (
      <TrendingUp className="w-5 h-5" />
    ) : activeSection === "crypto" ? (
      <Coins className="w-5 h-5" />
    ) : activeSection === "commodities" ? (
      <Mountain className="w-5 h-5" />
    ) : (
      <Handshake className="w-5 h-5" />
    );

  const sectionTitle =
    activeSection === "stocks"
      ? "Aandelen"
      : activeSection === "crypto"
        ? "Crypto"
        : activeSection === "commodities"
          ? "Grondstoffen"
          : "Leningen";

  const sectionIconColor =
    activeSection === "dashboard"
      ? "text-primary"
      : activeSection === "stocks"
        ? "text-primary"
        : activeSection === "crypto"
          ? "text-chart-2"
          : activeSection === "commodities"
            ? "text-amber-500"
            : "text-emerald-500";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Toaster position="top-right" richColors />

      {/* Top header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="h-14 flex items-center justify-between gap-4 px-4 sm:px-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-primary flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <span className="font-semibold text-sm tracking-tight">Berekenen</span>
              <span className="text-xs text-muted-foreground ml-1.5 font-mono">VWB</span>
            </div>
          </div>

          {/* Actions */}
          <nav className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8 px-2"
              title="Vernieuwen"
            >
              <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
            </Button>
          </nav>
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar — desktop only */}
        <aside className="hidden md:flex flex-col w-52 shrink-0 border-r border-border bg-sidebar sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
          <nav className="flex flex-col gap-1 p-3 pt-4">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(s.id)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left w-full",
                  activeSection === s.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                <span
                  className={cn(
                    activeSection === s.id
                      ? s.id === "commodities"
                        ? "text-amber-500"
                        : s.id === "loans"
                          ? "text-emerald-500"
                          : s.id === "settings"
                            ? "text-muted-foreground"
                            : "text-primary"
                      : "text-muted-foreground",
                    s.id === "dashboard" && activeSection === s.id && "text-primary"
                  )}
                >
                  {s.icon}
                </span>
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-8">

            {activeSection === "dashboard" ? (
              /* Dashboard landingspagina */
              <section aria-labelledby="portfolio-dashboard-heading">
                <h1 className="text-xl font-bold tracking-tight flex items-center gap-2 mb-6">
                  <span className="text-primary">
                    <LayoutDashboard className="w-5 h-5" />
                  </span>
                  Dashboard
                </h1>
                <PortfolioDashboard
                  assets={assets}
                  loans={loans}
                  commodityTickers={commodityTickers}
                  terMap={terMap}
                  onNavigate={(section) => setActiveSection(section)}
                />
              </section>
            ) : isSettings ? (
              /* Instellingen tab */
              <section aria-labelledby="settings-heading">
                <h1 className="text-xl font-bold tracking-tight flex items-center gap-2 mb-6">
                  <span className="text-muted-foreground">
                    <Settings className="w-5 h-5" />
                  </span>
                  Instellingen
                </h1>
                <SettingsPage />
              </section>
            ) : isYearOverview ? (
              /* Jaaroverzicht tab — full width, all assets */
              <section aria-labelledby="year-overview-heading">
                <h1 className="text-xl font-bold tracking-tight flex items-center gap-2 mb-6">
                  <span className="text-primary">
                    <CalendarDays className="w-5 h-5" />
                  </span>
                  Jaaroverzicht
                </h1>
                <YearOverview assets={assets} terMap={terMap} commodityTickers={commodityTickers} loans={loans} />
              </section>
            ) : isLoans ? (
              /* Leningen tab */
              <section aria-labelledby="loans-heading">
                <h1 className="text-xl font-bold tracking-tight flex items-center gap-2 mb-6">
                  <span className="text-emerald-500">
                    <Handshake className="w-5 h-5" />
                  </span>
                  Leningen
                </h1>
                <LoansPage />
              </section>
            ) : (
              <>
                {/* Section title */}
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                      <span className={sectionIconColor}>{sectionIcon}</span>
                      {sectionTitle}
                    </h1>
                    {!isLoading && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {filteredAssets.length === 0
                          ? "Nog geen assets"
                          : `${filteredAssets.length} asset${filteredAssets.length !== 1 ? "s" : ""}`}
                      </p>
                    )}
                  </div>

                  {/* Section-specific add button */}
                  {activeSection === "stocks" && (
                    <AddAssetDialog
                      updateOngoingCosts={updateOngoingCosts}
                      updateTer={updateTer}
                      allowedAssetTypes={["stock", "etf"]}
                      apiKey={twelveDataApiKey}
                    >
                      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                        <Plus className="w-3.5 h-3.5" />
                        Asset toevoegen
                      </Button>
                    </AddAssetDialog>
                  )}
                  {activeSection === "crypto" && (
                    <AddAssetDialog
                      updateOngoingCosts={updateOngoingCosts}
                      updateTer={updateTer}
                      forcedAssetType="crypto"
                      apiKey={twelveDataApiKey}
                    >
                      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                        <Plus className="w-3.5 h-3.5" />
                        Asset toevoegen
                      </Button>
                    </AddAssetDialog>
                  )}
                  {isCommodities && (
                    <AddCommodityAssetDialog assets={assets}>
                      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                        <Plus className="w-3.5 h-3.5" />
                        Grondstof toevoegen
                      </Button>
                    </AddCommodityAssetDialog>
                  )}
                </div>

                {/* Dashboard — section-specific */}
                <section aria-labelledby="dashboard-heading">
                  <h2 id="dashboard-heading" className="sr-only">
                    Portfolio samenvatting
                  </h2>
                  <Dashboard assets={filteredAssets} isLoading={isLoading} />
                </section>

                {/* Assets list */}
                <section aria-labelledby="assets-heading">
                  <h2 id="assets-heading" className="text-base font-semibold tracking-tight mb-4">
                    Mijn assets
                  </h2>
                  <AssetsList
                    assets={filteredAssets}
                    isLoading={isLoading}
                    terMap={terMap}
                    updateTer={updateTer}
                    ongoingCostsMap={ongoingCostsMap}
                    updateOngoingCosts={updateOngoingCosts}
                    commodityTickers={commodityTickers}
                  />
                </section>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Mobile tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border">
        <div className="flex">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-2.5 px-1 text-xs font-medium transition-colors",
                activeSection === s.id
                  ? s.id === "commodities"
                    ? "text-amber-500"
                    : s.id === "loans"
                      ? "text-emerald-500"
                      : s.id === "settings"
                        ? "text-foreground"
                        : "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={s.label}
            >
              <span>{s.icon}</span>
              <span className="text-[10px]">{s.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <footer className="hidden md:block border-t border-border py-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <p className="text-xs text-muted-foreground text-center">
            © 2026. Gebouwd met ❤️ via{" "}
            <a
              href="https://caffeine.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
