/**
 * Property-Based Tests for ETag Utility
 *
 * Feature: performance-optimization, Property 8: ETag Conditional Response
 *
 * Validates: Requirements 15.4
 *
 * For any data payload, `generateETag` SHALL produce a deterministic string.
 * For any request ETag that exactly matches the current ETag (with or without
 * weak validator prefix), `shouldReturn304` SHALL return true.
 * For any request ETag that does not match or is null, `shouldReturn304` SHALL
 * return false.
 */

import * as fc from "fast-check";
import { generateETag, shouldReturn304 } from "@/lib/etag";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Arbitrary for JSON-serializable data payloads.
 * Covers primitives, arrays, and nested objects.
 */
const jsonPayloadArb: fc.Arbitrary<unknown> = fc.jsonValue();

/**
 * Generates a 32-character hex string arbitrary using array of hex chars.
 */
const hexChars = "0123456789abcdef".split("");
const hex32Arb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...hexChars), { minLength: 32, maxLength: 32 })
  .map((chars) => chars.join(""));

/**
 * Arbitrary for valid strong ETag strings (quoted MD5 hex).
 * Format: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" (32 hex chars in quotes)
 */
const strongETagArb: fc.Arbitrary<string> = hex32Arb.map((hex) => `"${hex}"`);

/**
 * Arbitrary for weak ETag strings (W/ prefix + quoted hex).
 */
const weakETagArb: fc.Arbitrary<string> = strongETagArb.map(
  (strong) => `W/${strong}`
);

/**
 * Arbitrary for ETag strings that are guaranteed to differ from a given ETag.
 * Generates a random hex string that won't collide with the target.
 */
function nonMatchingETagArb(currentETag: string): fc.Arbitrary<string> {
  return hex32Arb
    .map((hex) => `"${hex}"`)
    .filter((etag) => etag !== currentETag);
}

// ---------------------------------------------------------------------------
// Property 8: ETag Conditional Response
// ---------------------------------------------------------------------------

describe("Property 8: ETag Conditional Response", () => {
  // ── Determinism ────────────────────────────────────────────────────────────

  describe("generateETag determinism", () => {
    it("produces the same ETag for the same data payload on repeated calls", () => {
      fc.assert(
        fc.property(jsonPayloadArb, (data) => {
          const etag1 = generateETag(data);
          const etag2 = generateETag(data);
          return etag1 === etag2;
        }),
        { numRuns: 200, verbose: true }
      );
    });

    it("produces a valid strong ETag format (quoted 32-char hex)", () => {
      fc.assert(
        fc.property(jsonPayloadArb, (data) => {
          const etag = generateETag(data);
          return /^"[a-f0-9]{32}"$/.test(etag);
        }),
        { numRuns: 200, verbose: true }
      );
    });
  });

  // ── Matching logic (shouldReturn304 returns true) ──────────────────────────

  describe("shouldReturn304 returns true on match", () => {
    it("returns true when request ETag exactly matches current ETag (strong)", () => {
      fc.assert(
        fc.property(jsonPayloadArb, (data) => {
          const currentETag = generateETag(data);
          return shouldReturn304(currentETag, currentETag) === true;
        }),
        { numRuns: 200, verbose: true }
      );
    });

    it("returns true when request ETag has W/ prefix but matches after stripping", () => {
      fc.assert(
        fc.property(jsonPayloadArb, (data) => {
          const currentETag = generateETag(data);
          const weakRequestETag = `W/${currentETag}`;
          return shouldReturn304(weakRequestETag, currentETag) === true;
        }),
        { numRuns: 200, verbose: true }
      );
    });

    it("returns true for arbitrary strong ETags that match exactly", () => {
      fc.assert(
        fc.property(strongETagArb, (etag) => {
          return shouldReturn304(etag, etag) === true;
        }),
        { numRuns: 200, verbose: true }
      );
    });

    it("returns true for arbitrary weak ETags matching the strong equivalent", () => {
      fc.assert(
        fc.property(strongETagArb, (strongEtag) => {
          const weakEtag = `W/${strongEtag}`;
          return shouldReturn304(weakEtag, strongEtag) === true;
        }),
        { numRuns: 200, verbose: true }
      );
    });
  });

  // ── Non-matching logic (shouldReturn304 returns false) ─────────────────────

  describe("shouldReturn304 returns false on non-match", () => {
    it("returns false when requestETag is null", () => {
      fc.assert(
        fc.property(strongETagArb, (currentETag) => {
          return shouldReturn304(null, currentETag) === false;
        }),
        { numRuns: 100, verbose: true }
      );
    });

    it("returns false when request ETag does not match current ETag", () => {
      fc.assert(
        fc.property(
          strongETagArb.chain((currentETag) =>
            fc.tuple(fc.constant(currentETag), nonMatchingETagArb(currentETag))
          ),
          ([currentETag, requestETag]) => {
            return shouldReturn304(requestETag, currentETag) === false;
          }
        ),
        { numRuns: 200, verbose: true }
      );
    });

    it("returns false when weak request ETag does not match current ETag", () => {
      fc.assert(
        fc.property(
          strongETagArb.chain((currentETag) =>
            fc.tuple(
              fc.constant(currentETag),
              nonMatchingETagArb(currentETag).map((e) => `W/${e}`)
            )
          ),
          ([currentETag, weakRequestETag]) => {
            return shouldReturn304(weakRequestETag, currentETag) === false;
          }
        ),
        { numRuns: 200, verbose: true }
      );
    });

    it("returns false for different data payloads generating different ETags", () => {
      fc.assert(
        fc.property(
          fc.tuple(jsonPayloadArb, jsonPayloadArb).filter(
            ([a, b]) => JSON.stringify(a) !== JSON.stringify(b)
          ),
          ([dataA, dataB]) => {
            const etagA = generateETag(dataA);
            const etagB = generateETag(dataB);
            // If the ETags differ, shouldReturn304 must return false
            if (etagA !== etagB) {
              return shouldReturn304(etagA, etagB) === false;
            }
            // Hash collision (extremely unlikely) — still valid
            return true;
          }
        ),
        { numRuns: 200, verbose: true }
      );
    });
  });
});
