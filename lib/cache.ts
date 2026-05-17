import "server-only";

import { cache } from "react";
import { prisma } from "./prisma";
import { fetchDashboardData } from "./dashboard-data";
import type { DashboardInitialData } from "./dashboard-data";

/**
 * Server-side cache layer combining:
 * 1. Cross-request TTL cache (in-memory Map with expiry) — persists dashboard
 *    data across separate HTTP requests for the same user.
 * 2. React cache() for per-request deduplication — identical calls within the
 *    same server render share a single execution.
 */

// ---------------------------------------------------------------------------
// Cross-Request TTL Cache
// ---------------------------------------------------------------------------

/** Default TTL for dashboard data cache: 30 seconds */
const DASHBOARD_CACHE_TTL_MS = 30_000;

interface CacheEntry {
  data: DashboardInitialData;
  expiresAt: number;
}

/**
 * In-memory cross-request cache keyed by userId.
 * Entries expire after DASHBOARD_CACHE_TTL_MS milliseconds.
 * This persists across HTTP requests within the same server process.
 */
const dashboardCache = new Map<string, CacheEntry>();

/**
 * Invalidate the cross-request dashboard cache for a specific user.
 * Call this from mutation API routes (record, budget, accounts) to ensure
 * the next dashboard load fetches fresh data.
 */
export function invalidateDashboardCache(userId: string): void {
  dashboardCache.delete(userId);
}

/**
 * Cached wrapper around fetchDashboardData with cross-request TTL cache.
 *
 * Behavior:
 * - If a valid (non-expired) cache entry exists for the userId, returns it
 *   immediately without executing any database/Sheets queries.
 * - If no cache entry exists (cold start) or the entry has expired, executes
 *   a fresh query via fetchDashboardData, stores the result in cache, and
 *   returns it.
 * - React cache() provides additional per-request deduplication on top of the
 *   cross-request cache.
 *
 * Budget calculations, account balances, and all data remain identical whether
 * served from cache or fresh query — the cache stores the complete result.
 */
export const getCachedDashboardData = cache(
  async (userId: string): Promise<DashboardInitialData> => {
    const now = Date.now();
    const cached = dashboardCache.get(userId);

    if (cached && now < cached.expiresAt) {
      return cached.data;
    }

    // Cold start or expired — execute fresh query
    const freshData = await fetchDashboardData(userId);

    dashboardCache.set(userId, {
      data: freshData,
      expiresAt: now + DASHBOARD_CACHE_TTL_MS,
    });

    return freshData;
  }
);

/**
 * Cached categories fetch with select-only fields.
 * Returns only the fields needed by dashboard and budget components.
 */
export const getCachedCategories = cache(
  async (userId: string) => {
    return prisma.category.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        type: true,
        isSavings: true,
        rolloverEnabled: true,
        budgetType: true,
      },
      orderBy: { name: "asc" },
    });
  }
);

/**
 * Cached active accounts fetch with select-only fields.
 * Returns only the fields needed by dashboard and transaction components.
 */
export const getCachedAccounts = cache(
  async (userId: string) => {
    return prisma.account.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        name: true,
        currency: true,
        color: true,
        icon: true,
        accountTypeId: true,
      },
    });
  }
);
