import fc from "fast-check";
import {
  handleSheetsFallback,
  cacheSheetResponse,
} from "@/lib/sheets-fallback";

/**
 * Property 5: Google Sheets API Fallback Graceful Degradation
 *
 * For any API error and user ID, the `handleSheetsFallback` function SHALL
 * return either cached stale data (when a cache entry exists within the TTL)
 * with `isStale: true`, or the result of `emptyDataFactory()` with
 * `isStale: false`, and SHALL always include a non-null `error` string
 * describing the failure.
 *
 * **Validates: Requirements 8.4**
 */

// Arbitrary: non-empty user ID strings
const userIdArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

// Arbitrary: various error types (Error instances and non-Error values)
const errorArb = fc.oneof(
  fc.string({ minLength: 1 }).map((msg) => new Error(msg)),
  fc.string({ minLength: 1 }),
  fc.integer(),
  fc.record({ code: fc.integer(), message: fc.string() }),
  fc.constant(null),
  fc.constant(undefined)
);

// Arbitrary: data that could be cached or returned by emptyDataFactory
const dataArb = fc.oneof(
  fc.array(fc.integer()),
  fc.record({ items: fc.array(fc.string()) }),
  fc.constant([]),
  fc.constant({})
);

describe("Property 5: Google Sheets API Fallback Graceful Degradation", () => {
  it("always returns a non-null error string for any error and user ID", () => {
    fc.assert(
      fc.property(userIdArb, errorArb, (userId, error) => {
        const result = handleSheetsFallback(userId, error, () => []);

        // error SHALL always be a non-null string
        expect(result.error).not.toBeNull();
        expect(typeof result.error).toBe("string");
        expect((result.error as string).length).toBeGreaterThan(0);
      }),
      { numRuns: 200 }
    );
  });

  it("returns emptyDataFactory result with isStale: false when no cache exists", () => {
    fc.assert(
      fc.property(userIdArb, errorArb, dataArb, (userId, error, emptyData) => {
        // Use a unique user ID prefix to avoid cache collisions with other tests
        const uniqueUserId = `no-cache-${userId}-${Date.now()}-${Math.random()}`;

        const result = handleSheetsFallback(uniqueUserId, error, () => emptyData);

        // When no cache exists, should return emptyDataFactory result
        expect(result.data).toEqual(emptyData);
        expect(result.isStale).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it("returns cached stale data with isStale: true when cache entry exists within TTL", () => {
    fc.assert(
      fc.property(userIdArb, errorArb, dataArb, dataArb, (userId, error, cachedData, emptyData) => {
        // Use a unique user ID to avoid collisions
        const uniqueUserId = `cached-${userId}-${Date.now()}-${Math.random()}`;

        // Pre-populate the cache
        cacheSheetResponse(uniqueUserId, cachedData);

        const result = handleSheetsFallback(uniqueUserId, error, () => emptyData);

        // When cache exists within TTL, should return cached data with isStale: true
        expect(result.data).toEqual(cachedData);
        expect(result.isStale).toBe(true);
        expect(result.error).not.toBeNull();
        expect(typeof result.error).toBe("string");
        expect((result.error as string).length).toBeGreaterThan(0);
      }),
      { numRuns: 200 }
    );
  });

  it("result is always one of two valid states: stale cached data or empty factory data", () => {
    fc.assert(
      fc.property(
        userIdArb,
        errorArb,
        dataArb,
        dataArb,
        fc.boolean(),
        (userId, error, cachedData, emptyData, shouldCache) => {
          const uniqueUserId = `state-${userId}-${Date.now()}-${Math.random()}`;

          if (shouldCache) {
            cacheSheetResponse(uniqueUserId, cachedData);
          }

          const result = handleSheetsFallback(uniqueUserId, error, () => emptyData);

          // Must be one of two valid states
          if (result.isStale) {
            // State 1: cached stale data
            expect(result.data).toEqual(cachedData);
            expect(result.isStale).toBe(true);
          } else {
            // State 2: empty factory data
            expect(result.data).toEqual(emptyData);
            expect(result.isStale).toBe(false);
          }

          // In both states, error must be a non-null non-empty string
          expect(result.error).not.toBeNull();
          expect(typeof result.error).toBe("string");
          expect((result.error as string).length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("Error instances produce the error message, non-Error values produce generic message", () => {
    fc.assert(
      fc.property(
        userIdArb,
        fc.string({ minLength: 1 }).map((msg) => new Error(msg)),
        (userId, error) => {
          const uniqueUserId = `errmsg-${userId}-${Date.now()}-${Math.random()}`;
          const result = handleSheetsFallback(uniqueUserId, error, () => []);

          // Error instances should use the error.message
          expect(result.error).toBe(error.message);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("non-Error values produce the generic fallback error message", () => {
    const nonErrorArb = fc.oneof(
      fc.string(),
      fc.integer(),
      fc.record({ code: fc.integer() }),
      fc.constant(null),
      fc.constant(undefined)
    );

    fc.assert(
      fc.property(userIdArb, nonErrorArb, (userId, error) => {
        const uniqueUserId = `generic-${userId}-${Date.now()}-${Math.random()}`;
        const result = handleSheetsFallback(uniqueUserId, error, () => []);

        // Non-Error values should produce the generic message
        expect(result.error).toBe("Google Sheets API error");
      }),
      { numRuns: 100 }
    );
  });
});
