"use client";

import { useEffect, useState } from "react";

type Mode = "light" | "dark";

export function useTheme() {
  const [mode, setMode] = useState<Mode>("light");

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
  }, []);

  function applyMode(m: Mode) {
    document.documentElement.classList.toggle("dark", m === "dark");
  }

  function toggleMode() {
    const next: Mode = mode === "dark" ? "light" : "dark";
    applyMode(next);
    localStorage.setItem("theme", next);
    setMode(next);
  }

  return { theme: mode, toggle: toggleMode };
}
