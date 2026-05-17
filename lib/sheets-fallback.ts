export interface SheetsFallbackResult<T> {
  data: T;
  isStale: boolean;
  error: string | null;
}

// In-memory cache for last successful Sheets response per user
const sheetsCache = new Map<string, { data: unknown; timestamp: number }>();
const STALE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function handleSheetsFallback<T>(
  userId: string,
  error: unknown,
  emptyDataFactory: () => T
): SheetsFallbackResult<T> {
  const cached = sheetsCache.get(userId);

  if (cached && Date.now() - cached.timestamp < STALE_TTL_MS) {
    return {
      data: cached.data as T,
      isStale: true,
      error: error instanceof Error ? error.message : "Google Sheets API error",
    };
  }

  return {
    data: emptyDataFactory(),
    isStale: false,
    error: error instanceof Error ? error.message : "Google Sheets API error",
  };
}

export function cacheSheetResponse(userId: string, data: unknown): void {
  sheetsCache.set(userId, { data, timestamp: Date.now() });
}
