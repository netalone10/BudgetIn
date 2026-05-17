import fc from "fast-check";
import { normalizePaginationParams, paginateArray } from "@/lib/pagination";

/**
 * Property 4: Pagination Limit Enforcement
 *
 * For any pagination parameters (page ≥ 1, limit ≥ 1), the normalizePaginationParams
 * function SHALL return a limit that is at most MAX_LIMIT (200). For any input array
 * of arbitrary length and any pagination parameters, paginateArray SHALL return a data
 * array whose length is at most the normalized limit, and the default limit SHALL be 50
 * when no limit parameter is provided.
 *
 * **Validates: Requirements 6.4, 15.2**
 */

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

describe("Property 4: Pagination Limit Enforcement", () => {
  describe("normalizePaginationParams - limit never exceeds MAX_LIMIT", () => {
    it("for any page and limit values, normalized limit is at most MAX_LIMIT (200)", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: 10000 }),
          fc.integer({ min: -1000, max: 10000 }),
          (page, limit) => {
            const result = normalizePaginationParams({ page, limit });
            return result.limit <= MAX_LIMIT;
          }
        ),
        { numRuns: 1000 }
      );
    });

    it("for any positive limit, normalized limit is at most MAX_LIMIT", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1_000_000 }),
          (limit) => {
            const result = normalizePaginationParams({ limit });
            return result.limit <= MAX_LIMIT;
          }
        ),
        { numRuns: 1000 }
      );
    });

    it("normalized limit is always at least 1", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: 10000 }),
          (limit) => {
            const result = normalizePaginationParams({ limit });
            return result.limit >= 1;
          }
        ),
        { numRuns: 1000 }
      );
    });

    it("normalized page is always at least 1", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: 10000 }),
          (page) => {
            const result = normalizePaginationParams({ page });
            return result.page >= 1;
          }
        ),
        { numRuns: 1000 }
      );
    });
  });

  describe("normalizePaginationParams - default limit is 50", () => {
    it("when no limit is provided, default limit is 50", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          (page) => {
            const result = normalizePaginationParams({ page });
            return result.limit === DEFAULT_LIMIT;
          }
        ),
        { numRuns: 1000 }
      );
    });

    it("when limit is undefined, default limit is 50 regardless of page", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: 10000 }),
          (page) => {
            const result = normalizePaginationParams({ page, limit: undefined });
            return result.limit === DEFAULT_LIMIT;
          }
        ),
        { numRuns: 1000 }
      );
    });
  });

  describe("paginateArray - data length respects normalized limit", () => {
    it("for any array and pagination params, data length is at most the normalized limit", () => {
      fc.assert(
        fc.property(
          fc.array(fc.anything(), { minLength: 0, maxLength: 1000 }),
          fc.integer({ min: -100, max: 100 }),
          fc.integer({ min: -100, max: 1000 }),
          (items, page, limit) => {
            const result = paginateArray(items, { page, limit });
            const normalized = normalizePaginationParams({ page, limit });
            return result.data.length <= normalized.limit;
          }
        ),
        { numRuns: 1000 }
      );
    });

    it("for any array and pagination params, data length never exceeds MAX_LIMIT (200)", () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer(), { minLength: 0, maxLength: 2000 }),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 10000 }),
          (items, page, limit) => {
            const result = paginateArray(items, { page, limit });
            return result.data.length <= MAX_LIMIT;
          }
        ),
        { numRuns: 1000 }
      );
    });

    it("when no limit is provided, data length is at most DEFAULT_LIMIT (50)", () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer(), { minLength: 0, maxLength: 500 }),
          fc.integer({ min: 1, max: 10 }),
          (items, page) => {
            const result = paginateArray(items, { page });
            return result.data.length <= DEFAULT_LIMIT;
          }
        ),
        { numRuns: 1000 }
      );
    });

    it("pagination metadata limit matches normalized limit", () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer(), { minLength: 0, maxLength: 500 }),
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 1, max: 500 }),
          (items, page, limit) => {
            const result = paginateArray(items, { page, limit });
            const normalized = normalizePaginationParams({ page, limit });
            return result.pagination.limit === normalized.limit;
          }
        ),
        { numRuns: 1000 }
      );
    });
  });
});
