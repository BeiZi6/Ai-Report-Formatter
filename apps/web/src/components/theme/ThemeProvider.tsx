"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_THEME,
  isThemeId,
  THEME_OPTIONS,
  THEME_STORAGE_KEY,
  type ThemeId,
  type ThemeOption,
} from "@/lib/themes";

type ThemeContextValue = {
  theme: ThemeId;
  options: ThemeOption[];
  setTheme: (theme: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const applyTheme = (theme: ThemeId) => {
  document.documentElement.setAttribute("data-theme", theme);
};

type ThemeProviderProps = {
  children: React.ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<ThemeId>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_THEME;
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(storedTheme) ? storedTheme : DEFAULT_THEME;
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    applyTheme(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      options: THEME_OPTIONS,
      setTheme,
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
}
