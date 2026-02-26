import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Dashboard } from "./components/Dashboard";
import { AssetsList } from "./components/AssetsList";
import { YearOverview } from "./components/YearOverview";
import { AddAssetDialog } from "./components/AddAssetDialog";
import { AddTransactionDialog } from "./components/AddTransactionDialog";
import { useAllAssets } from "./hooks/useQueries";
import { useTer } from "./hooks/useTer";
import { AssetType } from "./backend.d";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, RefreshCw, Coins, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

type Section = "stocks" | "crypto" | "yearoverview";

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
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
    id: "yearoverview",
    label: "Jaaroverzicht",
    icon: <CalendarDays className="w-4 h-4" />,
  },
];

export default function App() {
  const { data: assets = [], isLoading, refetch, isFetching } = useAllAssets();
  const { terMap, updateTer } = useTer();
  const [activeSection, setActiveSection] = useState<Section>("stocks");

  const filteredAssets = assets.filter((a) =>
    activeSection === "stocks"
      ? a.assetType === AssetType.stock
      : activeSection === "crypto"
        ? a.assetType === AssetType.crypto
        : true // yearoverview shows all
  );

  const isYearOverview = activeSection === "yearoverview";

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

            <AddTransactionDialog assets={assets}>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" />
                Transactie
              </Button>
            </AddTransactionDialog>

            <AddAssetDialog>
              <Button size="sm" className="h-8 gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" />
                Asset
              </Button>
            </AddAssetDialog>
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
                    activeSection === s.id ? "text-primary" : "text-muted-foreground"
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

            {isYearOverview ? (
              /* Jaaroverzicht tab — full width, all assets */
              <section aria-labelledby="year-overview-heading">
                <h1 className="text-xl font-bold tracking-tight flex items-center gap-2 mb-6">
                  <span className="text-primary">
                    <CalendarDays className="w-5 h-5" />
                  </span>
                  Jaaroverzicht
                </h1>
                <YearOverview assets={assets} terMap={terMap} />
              </section>
            ) : (
              <>
                {/* Section title */}
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                      <span
                        className={cn(
                          activeSection === "stocks" ? "text-primary" : "text-chart-2"
                        )}
                      >
                        {activeSection === "stocks" ? (
                          <TrendingUp className="w-5 h-5" />
                        ) : (
                          <Coins className="w-5 h-5" />
                        )}
                      </span>
                      {activeSection === "stocks" ? "Aandelen" : "Crypto"}
                    </h1>
                    {!isLoading && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {filteredAssets.length === 0
                          ? "Nog geen assets"
                          : `${filteredAssets.length} asset${filteredAssets.length !== 1 ? "s" : ""}`}
                      </p>
                    )}
                  </div>
                  <AddAssetDialog>
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                      <Plus className="w-3.5 h-3.5" />
                      Asset toevoegen
                    </Button>
                  </AddAssetDialog>
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
                "flex-1 flex flex-col items-center gap-1 py-2.5 px-3 text-xs font-medium transition-colors",
                activeSection === s.id
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
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
