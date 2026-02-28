import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import {
  CalendarDays,
  Coins,
  Handshake,
  LayoutDashboard,
  Mountain,
  Plus,
  Settings,
  TrendingUp,
} from "lucide-react";
import { AddAssetDialog } from "./components/AddAssetDialog";
import { AddCommodityAssetDialog } from "./components/AddCommodityAssetDialog";
import { AssetsList } from "./components/AssetsList";
import { Dashboard } from "./components/Dashboard";
import { LoansPage } from "./components/LoansPage";
import { LoginPage } from "./components/LoginPage";
import { PortfolioDashboard } from "./components/PortfolioDashboard";
import { SettingsPage } from "./components/SettingsPage";
import { YearOverview } from "./components/YearOverview";
import { Header } from "./components/layout/Header";
import { MobileNav } from "./components/layout/MobileNav";
import { Sidebar } from "./components/layout/Sidebar";
import { AppProvider, useAppContext } from "./context/AppContext";
import { useInternetIdentity } from "./hooks/useInternetIdentity";

function AppContent() {
  const {
    activeSection,
    setActiveSection,
    assets,
    loans,
    isLoading,
    stockAssets,
    cryptoAssets,
    commodityAssets,
    terMap,
    updateTer,
    ongoingCostsMap,
    updateOngoingCosts,
    commodityTickers,
    twelveDataApiKey,
  } = useAppContext();

  const filteredAssets =
    activeSection === "stocks"
      ? stockAssets
      : activeSection === "crypto"
        ? cryptoAssets
        : activeSection === "commodities"
          ? commodityAssets
          : assets;

  const SECTION_META: Record<
    string,
    { title: string; icon: React.ReactNode; iconColor: string }
  > = {
    stocks: {
      title: "Aandelen",
      icon: <TrendingUp className="w-5 h-5" />,
      iconColor: "text-primary",
    },
    crypto: {
      title: "Crypto",
      icon: <Coins className="w-5 h-5" />,
      iconColor: "text-chart-2",
    },
    commodities: {
      title: "Grondstoffen",
      icon: <Mountain className="w-5 h-5" />,
      iconColor: "text-amber-500",
    },
    loans: {
      title: "Leningen",
      icon: <Handshake className="w-5 h-5" />,
      iconColor: "text-emerald-500",
    },
    yearoverview: {
      title: "Jaaroverzicht",
      icon: <CalendarDays className="w-5 h-5" />,
      iconColor: "text-primary",
    },
    settings: {
      title: "Instellingen",
      icon: <Settings className="w-5 h-5" />,
      iconColor: "text-muted-foreground",
    },
    dashboard: {
      title: "Dashboard",
      icon: <LayoutDashboard className="w-5 h-5" />,
      iconColor: "text-primary",
    },
  };

  const meta = SECTION_META[activeSection] ?? SECTION_META.dashboard;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <div className="flex flex-1 min-h-0">
        <Sidebar />

        <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-8">
            {activeSection === "dashboard" && (
              <section>
                <h1 className="text-xl font-bold tracking-tight flex items-center gap-2 mb-6">
                  <span className={meta.iconColor}>{meta.icon}</span>
                  {meta.title}
                </h1>
                <PortfolioDashboard
                  assets={assets}
                  loans={loans}
                  commodityTickers={commodityTickers}
                  terMap={terMap}
                  onNavigate={(section) => setActiveSection(section)}
                />
              </section>
            )}

            {activeSection === "settings" && (
              <section>
                <h1 className="text-xl font-bold tracking-tight flex items-center gap-2 mb-6">
                  <span className={meta.iconColor}>{meta.icon}</span>
                  {meta.title}
                </h1>
                <SettingsPage />
              </section>
            )}

            {activeSection === "yearoverview" && (
              <section>
                <h1 className="text-xl font-bold tracking-tight flex items-center gap-2 mb-6">
                  <span className={meta.iconColor}>{meta.icon}</span>
                  {meta.title}
                </h1>
                <YearOverview
                  assets={assets}
                  terMap={terMap}
                  commodityTickers={commodityTickers}
                  loans={loans}
                />
              </section>
            )}

            {activeSection === "loans" && (
              <section>
                <h1 className="text-xl font-bold tracking-tight flex items-center gap-2 mb-6">
                  <span className={meta.iconColor}>{meta.icon}</span>
                  {meta.title}
                </h1>
                <LoansPage />
              </section>
            )}

            {(activeSection === "stocks" ||
              activeSection === "crypto" ||
              activeSection === "commodities") && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                      <span className={meta.iconColor}>{meta.icon}</span>
                      {meta.title}
                    </h1>
                    {!isLoading && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {filteredAssets.length === 0
                          ? "Nog geen assets"
                          : `${filteredAssets.length} asset${filteredAssets.length !== 1 ? "s" : ""}`}
                      </p>
                    )}
                  </div>

                  {activeSection === "stocks" && (
                    <AddAssetDialog
                      updateOngoingCosts={updateOngoingCosts}
                      updateTer={updateTer}
                      allowedAssetTypes={["stock", "etf"]}
                      apiKey={twelveDataApiKey}
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> Asset toevoegen
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
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> Asset toevoegen
                      </Button>
                    </AddAssetDialog>
                  )}
                  {activeSection === "commodities" && (
                    <AddCommodityAssetDialog assets={assets}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> Grondstof toevoegen
                      </Button>
                    </AddCommodityAssetDialog>
                  )}
                </div>

                <section>
                  <h2 className="sr-only">Portfolio samenvatting</h2>
                  <Dashboard assets={filteredAssets} isLoading={isLoading} />
                </section>

                <section>
                  <h2 className="text-base font-semibold tracking-tight mb-4">
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

      <MobileNav />

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

function AuthGate() {
  const { identity, isInitializing } = useInternetIdentity();
  const isAuthenticated = !!identity;

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center animate-pulse">
            <TrendingUp className="w-4 h-4 text-primary-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Laden...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default function App() {
  return (
    <>
      <Toaster position="top-right" richColors />
      <AuthGate />
    </>
  );
}
