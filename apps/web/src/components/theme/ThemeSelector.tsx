"use client";

import type { ChangeEvent } from "react";

import { isThemeId } from "@/lib/themes";

import { useTheme } from "./ThemeProvider";

export default function ThemeSelector() {
  const { theme, options, setTheme } = useTheme();

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextTheme = event.target.value;
    if (isThemeId(nextTheme)) {
      setTheme(nextTheme);
    }
  };

  return (
    <div className="theme-selector">
      <select
        id="theme-select"
        data-testid="theme-select"
        value={theme}
        onChange={handleChange}
        aria-label="主题选择"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
