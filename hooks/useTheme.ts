"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

type Mode = "light" | "dark";

function applyMode(m: Mode) {
  document.documentElement.classList.toggle("dark", m === "dark");
}

function getSnapshot(): Mode {
  const stored = localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getServerSnapshot(): Mode {
  return "light";
}

function subscribe(callback: () => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("storage", callback);
  mq.addEventListener("change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    mq.removeEventListener("change", callback);
  };
}

export function useTheme() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Keep the <html> class in sync with the resolved mode.
  useEffect(() => {
    applyMode(mode);
  }, [mode]);

  const toggleMode = useCallback(() => {
    const next: Mode = getSnapshot() === "dark" ? "light" : "dark";
    localStorage.setItem("theme", next);
    applyMode(next);
    // `storage` only fires in other tabs, so notify this tab's subscriber too.
    window.dispatchEvent(new StorageEvent("storage", { key: "theme" }));
  }, []);

  return { theme: mode, toggle: toggleMode };
}
