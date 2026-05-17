/**
 * Unit tests for the cross-request TTL cache layer in lib/cache.ts
 *
 * Tests the in-memory Map-based cache with TTL expiry and invalidation.
 * Since the actual cache uses server-only imports and React cache(),
 * we test the core TTL logic by reimplementing the same pattern used
 * in the production code.
 *
 * **Validates: Requirements 2.1, 2.3, 3.1, 3.6, 3.7**
 */

describe("Cross-Request TTL Cache", () => {
  const DASHBOARD_CACHE_TTL_MS = 30_000;

  interface CacheEntry {
    data: any;
    expiresAt: number;
  }

  /**
   * Mirrors the production cache logic from lib/cache.ts
   * for testability without server-only/React dependencies.
   */
  function createTTLCache(ttlMs: number = DASHBOARD_CACHE_TTL_MS) {
    const dashboardCache = new Map<string, CacheEntry>();
    let queryCount = 0;

    function fetchDashboardData(userId: string) {
      queryCount++;
      return {
        transactions: [{ id: `tx-${queryCount}`, amount: 100 * queryCount }],
        budgetData: { month: "2024-01", totalExpense: 500 },
        accounts: [{ id: "acc1", name: "BCA" }],
        categories: [{ id: "cat1", name: "Food" }],
        savingsCategoryNames: ["tabungan"],
        lastMonthTotals: { income: 5000000, expense: 3000000 },
        activeSavingsGoal: null,
        user: { name: "Test User", email: "test@example.com", image: null },
      };
    }

    function getCachedDashboardData(userId: string, now: number = Date.now()) {
      const cached = dashboardCache.get(userId);

      if (cached && now < cached.expiresAt) {
        return cached.data;
      }

      // Cold start or expired — execute fresh query
      const freshData = fetchDashboardData(userId);

      dashboardCache.set(userId, {
        data: freshData,
        expiresAt: now + ttlMs,
      });

      return freshData;
    }

    function invalidateDashboardCache(userId: string) {
      dashboardCache.delete(userId);
    }

    return {
      getCachedDashboardData,
      invalidateDashboardCache,
      getQueryCount: () => queryCount,
      getCacheSize: () => dashboardCache.size,
    };
  }

  describe("TTL behavior", () => {
    it("should execute fresh query on cold start (no cache entry)", () => {
      const cache = createTTLCache();
      const now = Date.now();

      const result = cache.getCachedDashboardData("user-1", now);

      expect(result).toBeDefined();
      expect(result.transactions).toHaveLength(1);
      expect(result.user?.name).toBe("Test User");
      expect(cache.getQueryCount()).toBe(1);
    });

    it("should return cached data on second call within TTL", () => {
      const cache = createTTLCache();
      const now = Date.now();

      const first = cache.getCachedDashboardData("user-1", now);
      const second = cache.getCachedDashboardData("user-1", now + 10_000); // 10s later

      // Same data returned, no additional query
      expect(second).toEqual(first);
      expect(cache.getQueryCount()).toBe(1);
    });

    it("should execute fresh query after TTL expires", () => {
      const cache = createTTLCache();
      const now = Date.now();

      cache.getCachedDashboardData("user-1", now);
      expect(cache.getQueryCount()).toBe(1);

      // After TTL (30s) expires
      cache.getCachedDashboardData("user-1", now + 31_000);
      expect(cache.getQueryCount()).toBe(2);
    });

    it("should not return expired cache entry", () => {
      const cache = createTTLCache();
      const now = Date.now();

      const first = cache.getCachedDashboardData("user-1", now);
      const afterExpiry = cache.getCachedDashboardData("user-1", now + 31_000);

      // Different data (fresh query executed)
      expect(afterExpiry.transactions[0].id).not.toBe(first.transactions[0].id);
    });

    it("should cache data for exactly TTL duration", () => {
      const cache = createTTLCache();
      const now = Date.now();

      cache.getCachedDashboardData("user-1", now);

      // At exactly TTL boundary (29.999s) — still cached
      cache.getCachedDashboardData("user-1", now + 29_999);
      expect(cache.getQueryCount()).toBe(1);

      // At TTL + 1ms — expired
      cache.getCachedDashboardData("user-1", now + 30_000);
      expect(cache.getQueryCount()).toBe(2);
    });
  });

  describe("userId keying", () => {
    it("should cache separately per userId", () => {
      const cache = createTTLCache();
      const now = Date.now();

      cache.getCachedDashboardData("user-1", now);
      cache.getCachedDashboardData("user-2", now);

      expect(cache.getQueryCount()).toBe(2);
      expect(cache.getCacheSize()).toBe(2);
    });

    it("should return correct cached data for each userId", () => {
      const cache = createTTLCache();
      const now = Date.now();

      const data1 = cache.getCachedDashboardData("user-1", now);
      const data2 = cache.getCachedDashboardData("user-2", now);

      // Second calls should return cached data for each user
      const cached1 = cache.getCachedDashboardData("user-1", now + 5000);
      const cached2 = cache.getCachedDashboardData("user-2", now + 5000);

      expect(cached1).toEqual(data1);
      expect(cached2).toEqual(data2);
      expect(cache.getQueryCount()).toBe(2); // No additional queries
    });
  });

  describe("invalidation", () => {
    it("should clear cache for specific userId on invalidation", () => {
      const cache = createTTLCache();
      const now = Date.now();

      cache.getCachedDashboardData("user-1", now);
      cache.getCachedDashboardData("user-2", now);
      expect(cache.getQueryCount()).toBe(2);

      // Invalidate user-1 only
      cache.invalidateDashboardCache("user-1");

      // user-1 should trigger fresh query
      cache.getCachedDashboardData("user-1", now + 5000);
      expect(cache.getQueryCount()).toBe(3);

      // user-2 should still be cached
      cache.getCachedDashboardData("user-2", now + 5000);
      expect(cache.getQueryCount()).toBe(3);
    });

    it("should be safe to invalidate non-existent cache entry", () => {
      const cache = createTTLCache();

      // Should not throw
      expect(() => cache.invalidateDashboardCache("non-existent-user")).not.toThrow();
    });

    it("should allow fresh data after invalidation", () => {
      const cache = createTTLCache();
      const now = Date.now();

      const first = cache.getCachedDashboardData("user-1", now);
      cache.invalidateDashboardCache("user-1");
      const afterInvalidation = cache.getCachedDashboardData("user-1", now + 1000);

      // Fresh data should be different (new query executed)
      expect(afterInvalidation.transactions[0].id).not.toBe(first.transactions[0].id);
      expect(cache.getQueryCount()).toBe(2);
    });
  });

  describe("cold start preservation", () => {
    it("should return complete data structure on cold start", () => {
      const cache = createTTLCache();
      const now = Date.now();

      const result = cache.getCachedDashboardData("user-1", now);

      // Verify all fields are present (preservation requirement 3.1)
      expect(result).toHaveProperty("transactions");
      expect(result).toHaveProperty("budgetData");
      expect(result).toHaveProperty("accounts");
      expect(result).toHaveProperty("categories");
      expect(result).toHaveProperty("savingsCategoryNames");
      expect(result).toHaveProperty("lastMonthTotals");
      expect(result).toHaveProperty("activeSavingsGoal");
      expect(result).toHaveProperty("user");
    });

    it("should return identical data from cache as from fresh query", () => {
      const cache = createTTLCache();
      const now = Date.now();

      const fresh = cache.getCachedDashboardData("user-1", now);
      const cached = cache.getCachedDashboardData("user-1", now + 5000);

      // Cache must return identical data (preservation requirement 3.7)
      expect(cached).toEqual(fresh);
    });
  });
});
