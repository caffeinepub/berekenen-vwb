import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light" | "midnight" | "forest" | "ocean";

const THEME_KEY = "portfolioflow-theme";

const DEFAULT_THEME: Theme = "dark";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  // Remove all theme classes
  root.classList.remove(
    "dark",
    "light",
    "theme-midnight",
    "theme-forest",
    "theme-ocean",
  );

  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    // light is default :root, no class needed
  } else if (theme === "midnight") {
    root.classList.add("dark", "theme-midnight");
  } else if (theme === "forest") {
    root.classList.add("dark", "theme-forest");
  } else if (theme === "ocean") {
    root.classList.add("dark", "theme-ocean");
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(THEME_KEY) as Theme | null;
    return stored ?? DEFAULT_THEME;
  });

  // Apply on mount
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    localStorage.setItem(THEME_KEY, newTheme);
    setThemeState(newTheme);
    applyTheme(newTheme);
  }, []);

  return { theme, setTheme };
}

export const THEME_OPTIONS: {
  value: Theme;
  label: string;
  description: string;
}[] = [
  {
    value: "dark",
    label: "Donker",
    description: "Donkere achtergrond, standaard thema",
  },
  { value: "light", label: "Licht", description: "Lichte achtergrond" },
  {
    value: "midnight",
    label: "Middernacht",
    description: "Diepzwart met blauwe accenten",
  },
  { value: "forest", label: "Bos", description: "Donker met groene accenten" },
  { value: "ocean", label: "Oceaan", description: "Donker met cyaan accenten" },
];
