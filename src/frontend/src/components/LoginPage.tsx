import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp } from "lucide-react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

export function LoginPage() {
  const { login, isLoggingIn, isInitializing } = useInternetIdentity();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center shadow-lg">
            <TrendingUp className="w-7 h-7 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              PortfolioFlow
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xs leading-relaxed">
              Grip op je beleggingen. Inzicht in je winst. Alles overzichtelijk
              in één app.
            </p>
          </div>
        </div>

        {/* Login card */}
        <div className="w-full bg-card border border-border rounded-xl p-6 flex flex-col gap-4 shadow-sm">
          <div className="flex flex-col gap-1.5 text-center">
            <h2 className="text-sm font-medium text-foreground">Inloggen</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Gebruik Internet Identity om veilig in te loggen. Je gegevens zijn
              uitsluitend voor jou toegankelijk.
            </p>
          </div>

          <Button
            onClick={login}
            disabled={isLoggingIn || isInitializing}
            className="w-full"
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Inloggen...
              </>
            ) : isInitializing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Laden...
              </>
            ) : (
              "Inloggen"
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()}. Gebouwd met ❤️ via{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            caffeine.ai
          </a>
        </p>
      </div>
    </div>
  );
}
