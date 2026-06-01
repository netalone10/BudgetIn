"use client";

/**
 * localStorage-backed SWR cache provider.
 *
 * Persists the SWR cache to localStorage so that repeat visits show data
 * instantly before any API call completes. On first visit, data loads from
 * the API and is cached. On subsequent visits, the cached data is served
 * immediately while SWR revalidates in the background.
 *
 * Safety:
 * - SSR-safe: returns empty Map on server (typeof window check)
 * - Debounced write: only persists on beforeunload to avoid localStorage thrashing
 * - Size-aware: if localStorage is full (QuotaExceededError), silently falls back
 *   to in-memory Map (no crash, no data loss — just loses persistence)
 */

export function localStorageProvider(): Map<string, unknown> {
  if (typeof window === "undefined") return new Map();

  // Hydrate from localStorage on client mount
  let map: Map<string, unknown>;
  try {
    const stored = localStorage.getItem("budgetin-cache");
    map = stored ? new Map(JSON.parse(stored)) : new Map();
  } catch {
    // Corrupted JSON — start fresh
    map = new Map();
  }

  // Persist on beforeunload (debounced to avoid thrashing)
  // beforeunload is the safest time — no active rendering, no race conditions
  window.addEventListener("beforeunload", () => {
    try {
      localStorage.setItem(
        "budgetin-cache",
        JSON.stringify(Array.from(map.entries()))
      );
    } catch {
      // QuotaExceededError — silently fail, next visit will just fetch fresh
    }
  });

  return map;
}
