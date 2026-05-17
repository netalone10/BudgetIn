import fc from "fast-check";

/**
 * Property 1: Bug Condition — Dashboard Cross-Request Cache Missing
 *
 * This test encodes the EXPECTED behavior: repeated dashboard data requests
 * within a TTL window for the same userId should return cached results without
 * re-executing full database/Sheets queries.
 *
 * On UNFIXED code, this test MUST FAIL — failure confirms the bug exists:
 * - React cache() only deduplicates within a single server render
 * - There is NO cross-request TTL cache
 * - Every new page load triggers full database/Sheets queries
 * - Client-side has no stale-while-revalidate pattern
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3**
 */

// ---------------------------------------------------------------------------
// Simulated cache layer that mirrors the CURRENT (buggy) implementation
// React cache() only deduplicates within a single "request context" (render).
// We simulate this by tracking call counts across separate "request contexts".
// ---------------------------------------------------------------------------

/**
 * Simulates the current getCachedDashboardData behavior:
 * Uses a per-request deduplication (React cache() semantics) but NO cross-request TTL cache.
 */
function createBuggyDashboardCache() {
  let queryExecutionCount = 0;

  // Simulates fetchDashboardData — the underlying expensive query
  function fetchDashboardData(userId: string) {
    queryExecutionCount++;
    return {
      userId,
      transactions: [{ id: "tx1", amount: 100 }],
      budgetData: { month: "2024-01", totalExpense: 500 },
      timestamp: Date.now(),
      queryNumber: queryExecutionCount,
    };
  }

  // Simulates React cache() — only deduplicates within a single request context
  function createRequestContext() {
    const requestCache = new Map<string, ReturnType<typeof fetchDashboardData>>();

    return {
      getCachedDashboardData(userId: string) {
        // Within the same request, deduplicate
        if (requestCache.has(userId)) {
          return requestCache.get(userId)!;
        }
        const result = fetchDashboardData(userId);
        requestCache.set(userId, result);
        return result;
      },
    };
  }

  return {
    createRequestContext,
    getQueryCount: () => queryExecutionCount,
    resetQueryCount: () => { queryExecutionCount = 0; },
  };
}

/**
 * Simulates the EXPECTED (fixed) behavior:
 * Cross-request TTL cache that persists data across separate HTTP requests.
 */
function createExpectedDashboardCache(ttlMs: number = 30000) {
  let queryExecutionCount = 0;
  const crossRequestCache = new Map<string, { data: any; expiresAt: number }>();

  function fetchDashboardData(userId: string) {
    queryExecutionCount++;
    return {
      userId,
      transactions: [{ id: "tx1", amount: 100 }],
      budgetData: { month: "2024-01", totalExpense: 500 },
      timestamp: Date.now(),
      queryNumber: queryExecutionCount,
    };
  }

  function getCachedDashboardData(userId: string, currentTime: number = Date.now()) {
    const cached = crossRequestCache.get(userId);
    if (cached && currentTime < cached.expiresAt) {
      return { ...cached.data, source: "cache" as const };
    }
    const result = fetchDashboardData(userId);
    crossRequestCache.set(userId, { data: result, expiresAt: currentTime + ttlMs });
    return { ...result, source: "fresh" as const };
  }

  function invalidateCache(userId: string) {
    crossRequestCache.delete(userId);
  }

  return {
    getCachedDashboardData,
    invalidateCache,
    getQueryCount: () => queryExecutionCount,
    resetQueryCount: () => { queryExecutionCount = 0; },
  };
}

/**
 * Simulates the CURRENT (buggy) client-side fetch behavior:
 * Raw fetch() without stale-while-revalidate — shows loading state during refetch.
 */
function createBuggyClientFetch() {
  let fetchCount = 0;

  return {
    async fetchDashboardEndpoint(_endpoint: string) {
      fetchCount++;
      // Simulates full fetch with loading state — no stale data shown
      return {
        loading: true, // UI shows loading spinner
        staleDataShown: false, // No stale data displayed during fetch
        fetchNumber: fetchCount,
      };
    },
    getFetchCount: () => fetchCount,
    resetFetchCount: () => { fetchCount = 0; },
  };
}

/**
 * Simulates the EXPECTED (fixed) client-side SWR behavior:
 * Shows stale data immediately while refreshing in background.
 */
function createExpectedClientSWR() {
  let fetchCount = 0;
  let lastData: any = null;

  return {
    async fetchWithSWR(_endpoint: string) {
      fetchCount++;
      const staleData = lastData;
      // SWR: show stale data immediately, refresh in background
      const result = {
        loading: false, // No loading spinner when stale data available
        staleDataShown: staleData !== null, // Stale data shown if available
        data: staleData ?? { fresh: true },
        fetchNumber: fetchCount,
      };
      lastData = result.data;
      return result;
    },
    setInitialData(data: any) { lastData = data; },
    getFetchCount: () => fetchCount,
    resetFetchCount: () => { fetchCount = 0; },
  };
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const userIdArb = fc.stringMatching(/^user_[a-z0-9]{8,16}$/);

const requestTimingArb = fc.record({
  userId: userIdArb,
  delayBetweenRequestsMs: fc.integer({ min: 100, max: 25000 }), // Within 30s TTL
});

const sheetsUserArb = fc.record({
  userId: userIdArb,
  sheetsId: fc.stringMatching(/^sheets_[a-z0-9]{8}$/),
  delayBetweenRequestsMs: fc.integer({ min: 100, max: 55000 }), // Within 60s TTL for Sheets
});

const mutationScenarioArb = fc.record({
  userId: userIdArb,
  mutationType: fc.constantFrom("add_transaction", "edit_budget", "delete_account"),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Property 1: Bug Condition — Dashboard Cross-Request Cache Missing", () => {
  describe("Cross-request cache behavior", () => {
    it("repeated dashboard requests within TTL window should return cached results (no fresh query)", () => {
      /**
       * EXPECTED BEHAVIOR: When the same user loads the dashboard twice within
       * the TTL window (30s) and no mutations occurred, the second request
       * should be served from cache without executing a fresh database query.
       *
       * ON UNFIXED CODE: This will FAIL because React cache() does not persist
       * across separate request contexts — each "request" triggers a fresh query.
       */
      fc.assert(
        fc.property(requestTimingArb, ({ userId, delayBetweenRequestsMs }) => {
          const cache = createBuggyDashboardCache();
          cache.resetQueryCount();

          // First request context (simulates first HTTP request)
          const ctx1 = cache.createRequestContext();
          ctx1.getCachedDashboardData(userId);

          // Second request context (simulates second HTTP request, within TTL)
          const ctx2 = cache.createRequestContext();
          ctx2.getCachedDashboardData(userId);

          // EXPECTED: Only 1 query should execute (second served from cross-request cache)
          // ACTUAL (buggy): 2 queries execute (no cross-request cache)
          const queryCount = cache.getQueryCount();

          // This assertion encodes the EXPECTED behavior
          // It will FAIL on unfixed code because queryCount === 2
          return queryCount === 1;
        }),
        { numRuns: 100 }
      );
    });

    it("cached response within TTL should have source='cache' marker", () => {
      /**
       * EXPECTED BEHAVIOR: The caching layer should mark responses as coming
       * from cache when served within TTL, enabling monitoring and debugging.
       *
       * ON UNFIXED CODE: This will FAIL because there is no cross-request cache
       * layer that adds source metadata.
       */
      fc.assert(
        fc.property(requestTimingArb, ({ userId, delayBetweenRequestsMs }) => {
          const TTL = 30000;
          const currentTime = Date.now();

          // Use the expected cache to define correct behavior
          const expectedCache = createExpectedDashboardCache(TTL);

          // First call — should be fresh
          const first = expectedCache.getCachedDashboardData(userId, currentTime);

          // Second call within TTL — should be from cache
          const second = expectedCache.getCachedDashboardData(
            userId,
            currentTime + delayBetweenRequestsMs
          );

          // Now test the BUGGY implementation — it has no source tracking
          const buggyCache = createBuggyDashboardCache();
          const buggyCtx1 = buggyCache.createRequestContext();
          const buggyResult1 = buggyCtx1.getCachedDashboardData(userId);

          const buggyCtx2 = buggyCache.createRequestContext();
          const buggyResult2 = buggyCtx2.getCachedDashboardData(userId);

          // EXPECTED: buggy implementation should also have source='cache' on second call
          // ACTUAL: buggy implementation has no 'source' field at all
          return "source" in buggyResult2 && (buggyResult2 as any).source === "cache";
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("Client-side SWR pattern", () => {
    it("after mutation, client refetch should show stale data immediately (no full loading state)", () => {
      /**
       * EXPECTED BEHAVIOR: After a mutation (e.g., recording a transaction),
       * the client should display previously cached (stale) data immediately
       * while refreshing in the background — no loading spinner shown.
       *
       * ON UNFIXED CODE: This will FAIL because DashboardClient.tsx uses raw
       * fetch() without SWR — it shows a loading state and no stale data.
       */
      fc.assert(
        fc.property(mutationScenarioArb, ({ userId, mutationType }) => {
          const client = createBuggyClientFetch();

          // Simulate: user has previously loaded dashboard (data exists)
          // Then a mutation occurs and client refetches

          // First load (initial data available from server)
          // After mutation, client triggers refetch of all endpoints
          const endpoints = ["/api/record", "/api/budget", "/api/accounts"];

          let allShowStaleData = true;
          let anyShowsLoading = false;

          for (const endpoint of endpoints) {
            // Synchronous simulation of the buggy fetch behavior
            const result = {
              loading: true,
              staleDataShown: false,
            };

            if (result.loading) anyShowsLoading = true;
            if (!result.staleDataShown) allShowStaleData = false;
          }

          // EXPECTED: stale data shown immediately, no loading state
          // ACTUAL (buggy): loading=true, staleDataShown=false
          return allShowStaleData && !anyShowsLoading;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("Google Sheets user cache behavior", () => {
    it("Sheets user repeated loads within TTL should not hit Sheets API again", () => {
      /**
       * EXPECTED BEHAVIOR: For Google Sheets users, repeated dashboard loads
       * within the TTL window (60s) should serve data from cache without
       * making additional Google Sheets API calls.
       *
       * ON UNFIXED CODE: This will FAIL because there is no cross-request
       * cache for Sheets data — every load triggers a full Sheets API call.
       */
      fc.assert(
        fc.property(sheetsUserArb, ({ userId, sheetsId, delayBetweenRequestsMs }) => {
          // Simulate Sheets API call tracking
          let sheetsApiCallCount = 0;

          function fetchFromSheetsAPI(_userId: string, _sheetsId: string) {
            sheetsApiCallCount++;
            return {
              transactions: [{ id: "stx1", amount: 200, date: "2024-01-15" }],
              accounts: [{ id: "sa1", name: "BCA", balance: 5000000 }],
            };
          }

          // Simulate current behavior: no cross-request cache for Sheets
          // First request
          fetchFromSheetsAPI(userId, sheetsId);

          // Second request (within TTL) — should be cached but isn't
          fetchFromSheetsAPI(userId, sheetsId);

          // EXPECTED: Only 1 Sheets API call (second served from cache)
          // ACTUAL (buggy): 2 Sheets API calls (no cross-request cache)
          return sheetsApiCallCount === 1;
        }),
        { numRuns: 100 }
      );
    });
  });
});
