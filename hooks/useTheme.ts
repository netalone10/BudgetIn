"use client";

import { useEffect, useState } from "react";

type Mode = "light" | "dark";
export type ColorTheme = "default" | "blue" | "green" | "purple" | "rose";

export const COLOR_THEMES: { value: ColorTheme; label: string; color: string }[] = [
  { value: "default", label: "Default", color: "oklch(0.205 0 0)" },
  { value: "blue",    label: "Blue",    color: "oklch(0.546 0.245 262.881)" },
  { value: "green",   label: "Green",   color: "oklch(0.527 0.154 150.069)" },
  { value: "purple",  label: "Purple",  color: "oklch(0.558 0.288 302.321)" },
  { value: "rose",    label: "Rose",    color: "oklch(0.586 0.253 17.585)" },
];

export function useTheme() {
  const [mode, setMode] = useState<Mode>("light");
  const [colorTheme, setColorTheme] = useState<ColorTheme>("default");

  useEffect(() => {
    // Restore mode
    const storedMode = localStorage.getItem("theme") as Mode | null;
    const initialMode =
      storedMode === "dark" || storedMode === "light"
        ? storedMode
        : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    applyMode(initialMode);
    setMode(initialMode);

    // Restore color theme
    const storedColor = localStorage.getItem("color-theme") as ColorTheme | null;
    const initialColor = COLOR_THEMES.find((t) => t.value === storedColor)
      ? storedColor!
      : "default";
    applyColor(initialColor);
    setColorTheme(initialColor);
  }, []);

  function applyMode(m: Mode) {
    document.documentElement.classList.toggle("dark", m === "dark");
  }

  function applyColor(c: ColorTheme) {
    if (c === "default") {
      document.documentElement.removeAttribute("data-color");
    } else {
      document.documentElement.setAttribute("data-color", c);
    }
  }

  function toggleMode() {
    const next: Mode = mode === "dark" ? "light" : "dark";
    applyMode(next);
    localStorage.setItem("theme", next);
    setMode(next);
  }

  function setThemeColor(c: ColorTheme) {
    applyColor(c);
    localStorage.setItem("color-theme", c);
    setColorTheme(c);
  }

  return { theme: mode, toggle: toggleMode, colorTheme, setThemeColor };
}
