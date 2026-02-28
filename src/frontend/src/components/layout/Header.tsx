import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogOut, RefreshCw, TrendingUp, User } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import { useInternetIdentity } from "../../hooks/useInternetIdentity";

export function Header() {
  const { refetch, isFetching, userName } = useAppContext();
  const { clear } = useInternetIdentity();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="h-14 flex items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <span className="font-semibold text-sm tracking-tight">
              Berekenen
            </span>
            <span className="text-xs text-muted-foreground ml-1.5 font-mono">
              VWB
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-2">
          {userName && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground px-2">
              <User className="w-3.5 h-3.5" />
              <span>{userName}</span>
            </div>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 px-2"
            title="Vernieuwen"
          >
            <RefreshCw
              className={cn("w-4 h-4", isFetching && "animate-spin")}
            />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={clear}
            className="h-8 px-2"
            title="Uitloggen"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </nav>
      </div>
    </header>
  );
}
