import "server-only";

import { cache } from "react";
import { prisma } from "./prisma";
import { fetchDashboardData } from "./dashboard-data";

/**
 * Server-side cache layer using React cache() for per-request deduplication.
 *
 * When multiple Server Components in a single request call the same cached
 * function with identical parameters, the underlying query executes only once
 * and the result is shared across all callers within that render.
 */

/**
 * Cached wrapper around fetchDashboardData.
 * Deduplicates the full dashboard data fetch within a single server request.
 */
export const getCachedDashboardData = cache(
  async (userId: string) => {
    return fetchDashboardData(userId);
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
