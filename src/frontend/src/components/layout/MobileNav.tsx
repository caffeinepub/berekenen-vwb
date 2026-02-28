import { cn } from "@/lib/utils";
import { type Section, useAppContext } from "../../context/AppContext";
import { SECTIONS } from "./Sidebar";

function sectionActiveColor(id: Section): string {
  if (id === "commodities") return "text-amber-500";
  if (id === "loans") return "text-emerald-500";
  if (id === "settings") return "text-foreground";
  return "text-primary";
}

export function MobileNav() {
  const { activeSection, setActiveSection } = useAppContext();

  return (
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
                ? sectionActiveColor(s.id)
                : "text-muted-foreground hover:text-foreground",
            )}
            title={s.label}
          >
            <span>{s.icon}</span>
            <span className="text-[10px]">{s.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
