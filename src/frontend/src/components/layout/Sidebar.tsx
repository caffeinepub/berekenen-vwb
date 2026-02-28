import { cn } from "@/lib/utils";
import {
  CalendarDays,
  Coins,
  Handshake,
  LayoutDashboard,
  Mountain,
  Settings,
  TrendingUp,
} from "lucide-react";
import { type Section, useAppContext } from "../../context/AppContext";

export const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] =
  [
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
    { id: "crypto", label: "Crypto", icon: <Coins className="w-4 h-4" /> },
    {
      id: "commodities",
      label: "Grondstoffen",
      icon: <Mountain className="w-4 h-4" />,
    },
    { id: "loans", label: "Leningen", icon: <Handshake className="w-4 h-4" /> },
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

function sectionIconColor(id: Section, isActive: boolean): string {
  if (!isActive) return "text-muted-foreground";
  if (id === "commodities") return "text-amber-500";
  if (id === "loans") return "text-emerald-500";
  if (id === "settings") return "text-muted-foreground";
  return "text-primary";
}

export function Sidebar() {
  const { activeSection, setActiveSection } = useAppContext();

  return (
    <aside className="hidden md:flex flex-col w-52 shrink-0 border-r border-border bg-sidebar sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
      <nav className="flex flex-col gap-1 p-3 pt-4">
        {SECTIONS.map((s) => {
          const isActive = activeSection === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left w-full",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <span className={sectionIconColor(s.id, isActive)}>{s.icon}</span>
              {s.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
