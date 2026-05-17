import fc from "fast-check";
import {
  getCacheControlHeader,
  type CacheProfile,
} from "@/lib/cache-headers";

/**
 * Property 1: Cache Header Classification Correctness
 *
 * For any API route configuration with a defined cache profile, the
 * getCacheControlHeader function SHALL return the exact Cache-Control header
 * string corresponding to that profile.
 *
 * **Validates: Requirements 2.2, 2.3**
 */

const EXPECTED_HEADERS: Record<CacheProfile, string> = {
  static: "public, max-age=31536000, immutable",
  "semi-static": "public, s-maxage=60, stale-while-revalidate=300",
  "private-mutable": "private, no-cache",
};

const cacheProfileArb: fc.Arbitrary<CacheProfile> = fc.constantFrom(
  "static" as const,
  "semi-static" as const,
  "private-mutable" as const
);

describe("Property 1: Cache Header Classification Correctness", () => {
  it("for any cache profile, getCacheControlHeader returns the exact expected Cache-Control string", () => {
    fc.assert(
      fc.property(cacheProfileArb, (profile) => {
        const result = getCacheControlHeader({ profile });
        expect(result).toBe(EXPECTED_HEADERS[profile]);
      }),
      { numRuns: 100 }
    );
  });

  it("static profile always returns immutable public header", () => {
    fc.assert(
      fc.property(fc.constant("static" as CacheProfile), (profile) => {
        const result = getCacheControlHeader({ profile });
        expect(result).toBe("public, max-age=31536000, immutable");
      }),
      { numRuns: 10 }
    );
  });

  it("semi-static profile always returns s-maxage with stale-while-revalidate header", () => {
    fc.assert(
      fc.property(fc.constant("semi-static" as CacheProfile), (profile) => {
        const result = getCacheControlHeader({ profile });
        expect(result).toBe("public, s-maxage=60, stale-while-revalidate=300");
      }),
      { numRuns: 10 }
    );
  });

  it("private-mutable profile always returns private no-cache header", () => {
    fc.assert(
      fc.property(
        fc.constant("private-mutable" as CacheProfile),
        (profile) => {
          const result = getCacheControlHeader({ profile });
          expect(result).toBe("private, no-cache");
        }
      ),
      { numRuns: 10 }
    );
  });

  it("the returned header is never empty for any valid profile", () => {
    fc.assert(
      fc.property(cacheProfileArb, (profile) => {
        const result = getCacheControlHeader({ profile });
        expect(result.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});
