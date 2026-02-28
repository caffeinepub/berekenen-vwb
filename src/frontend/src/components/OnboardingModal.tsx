import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface OnboardingModalProps {
  onComplete: (name: string) => Promise<void>;
}

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setIsSaving(true);
    try {
      await onComplete(trimmed);
    } catch {
      toast.error("Naam opslaan mislukt. Probeer opnieuw.");
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center shadow-lg">
            <TrendingUp className="w-7 h-7 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Welkom bij PortfolioFlow
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xs leading-relaxed">
              Vul je naam in om te beginnen. Je kunt dit later aanpassen via
              Instellingen.
            </p>
          </div>
        </div>

        {/* Name form */}
        <div className="w-full bg-card border border-border rounded-xl p-6 flex flex-col gap-4 shadow-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="onboarding-name">Jouw naam</Label>
              <Input
                id="onboarding-name"
                type="text"
                placeholder="Voer je naam in..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
                className="text-sm"
              />
            </div>
            <Button
              type="submit"
              disabled={!name.trim() || isSaving}
              className="w-full"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opslaan...
                </>
              ) : (
                "Doorgaan"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
