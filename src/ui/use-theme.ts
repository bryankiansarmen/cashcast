import { useState } from "react";

export type Theme = "light" | "dark";
const KEY = "cashcast-theme";

// Storage can be blocked or throw (private windows, cleared site data); the app works without it.
const stored = (): Theme | null => {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
};
const system = (): Theme =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

/** Applies a saved choice before first paint; with no saved choice the CSS follows the system theme. */
export function applyStoredTheme(): void {
  const t = stored();
  if (t) document.documentElement.dataset.theme = t;
}

/** the label does not track OS theme changes mid-session; reload picks them up. */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() => stored() ?? system());
  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* choice applies for this session only */
    }
    setTheme(next);
  };
  return { theme, toggle };
}
