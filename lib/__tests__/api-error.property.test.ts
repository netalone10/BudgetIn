/**
 * Property-Based Tests for api-error
 *
 * Feature: performance-optimization, Property 7: API Error Response Sanitization
 *
 * Validates: Requirements 15.3
 */

import * as fc from "fast-check";
import {
  sanitizeErrorForProduction,
  type ErrorType,
  type ApiErrorResponse,
} from "../api-error";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ERROR_TYPES: ErrorType[] = [
  "validation",
  "unauthorized",
  "forbidden",
  "not_found",
  "internal",
];

const EXPECTED_STATUS_CODES: Record<ErrorType, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  internal: 500,
};

const SAFE_MESSAGES: Record<ErrorType, string> = {
  validation: "Invalid request parameters",
  unauthorized: "Authentication required",
  forbidden: "Access denied",
  not_found: "Resource not found",
  internal: "Internal server error",
};

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Arbitrary for any valid ErrorType */
const errorTypeArb: fc.Arbitrary<ErrorType> = fc.constantFrom(...ERROR_TYPES);

/** Arbitrary for realistic error messages that could contain sensitive info */
const sensitiveMessageArb: fc.Arbitrary<string> = fc.oneof(
  // SQL-like errors
  fc.constant("SQL syntax error near line 42"),
  fc.constant("SELECT * FROM users WHERE id = 'admin' -- injection attempt"),
  // File path leaks
  fc.constant("Error at /app/lib/db.ts:42:5"),
  fc.constant("ENOENT: no such file or directory, open '/etc/secrets/db.conf'"),
  // Stack trace fragments
  fc.constant("TypeError: Cannot read properties of undefined (reading 'userId')"),
  // Connection strings
  fc.constant("Connection refused: postgres://admin:password123@db.internal:5432/prod"),
  // Arbitrary strings (could be anything)
  fc.string({ minLength: 1, maxLength: 500 }),
  // Strings with special characters
  fc.string({ minLength: 1, maxLength: 200, unit: "grapheme-ascii" })
);

/** Arbitrary for stack traces */
const stackTraceArb: fc.Arbitrary<string> = fc.tuple(
  sensitiveMessageArb,
  fc.array(
    fc.tuple(
      fc.string({ minLength: 1, maxLength: 30 }),
      fc.string({ minLength: 1, maxLength: 50 }),
      fc.nat({ max: 1000 }),
      fc.nat({ max: 100 })
    ),
    { minLength: 1, maxLength: 10 }
  )
).map(([msg, frames]) => {
  const frameLines = frames.map(
    ([fn, file, line, col]) => `    at ${fn} (${file}:${line}:${col})`
  );
  return `Error: ${msg}\n${frameLines.join("\n")}`;
});

// ---------------------------------------------------------------------------
// Property 7: API Error Response Sanitization
// ---------------------------------------------------------------------------

describe("Property 7: API Error Response Sanitization", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("in production mode, returns the correct HTTP status code for any error type", () => {
    fc.assert(
      fc.property(
        errorTypeArb,
        sensitiveMessageArb,
        (errorType, message) => {
          const error = new Error(message);
          const result = sanitizeErrorForProduction(error, errorType);

          return result.statusCode === EXPECTED_STATUS_CODES[errorType];
        }
      ),
      { numRuns: 200, verbose: true }
    );
  });

  it("in production mode, never includes the original error message in the response", () => {
    // Generate messages that are long enough to be meaningful sensitive data
    // (short strings like "C" or "4" trivially appear in status codes/codes)
    const meaningfulMessageArb = fc.string({ minLength: 5, maxLength: 500 }).filter(
      (msg) => {
        // Filter out messages that happen to be identical to any safe message
        return !Object.values(SAFE_MESSAGES).includes(msg);
      }
    );

    fc.assert(
      fc.property(
        errorTypeArb,
        meaningfulMessageArb,
        (errorType, message) => {
          const error = new Error(message);
          const result = sanitizeErrorForProduction(error, errorType);

          // The error field must be the safe generic message
          return result.error === SAFE_MESSAGES[errorType] && result.error !== message;
        }
      ),
      { numRuns: 200, verbose: true }
    );
  });

  it("in production mode, never includes stack traces in the response", () => {
    fc.assert(
      fc.property(
        errorTypeArb,
        sensitiveMessageArb,
        stackTraceArb,
        (errorType, message, stack) => {
          const error = new Error(message);
          error.stack = stack;
          const result = sanitizeErrorForProduction(error, errorType);

          const responseJson = JSON.stringify(result);
          // Stack trace must not appear in the response
          return !responseJson.includes(stack) && !responseJson.includes("stack");
        }
      ),
      { numRuns: 200, verbose: true }
    );
  });

  it("in production mode, the error field is always the safe generic message for the error type", () => {
    fc.assert(
      fc.property(
        errorTypeArb,
        sensitiveMessageArb,
        (errorType, message) => {
          const error = new Error(message);
          const result = sanitizeErrorForProduction(error, errorType);

          return result.error === SAFE_MESSAGES[errorType];
        }
      ),
      { numRuns: 200, verbose: true }
    );
  });

  it("in production mode, the response only contains error, code, and statusCode fields", () => {
    fc.assert(
      fc.property(
        errorTypeArb,
        sensitiveMessageArb,
        (errorType, message) => {
          const error = new Error(message);
          const result = sanitizeErrorForProduction(error, errorType);

          const keys = Object.keys(result).sort();
          return (
            keys.length === 3 &&
            keys[0] === "code" &&
            keys[1] === "error" &&
            keys[2] === "statusCode"
          );
        }
      ),
      { numRuns: 100, verbose: true }
    );
  });

  it("in production mode, handles non-Error objects without leaking their content", () => {
    // Generate non-Error values with meaningful string representations
    const meaningfulNonErrorArb = fc.oneof(
      fc.string({ minLength: 5, maxLength: 200 }),
      fc.integer({ min: 100000, max: 999999 }),
      fc.constant("database connection failed"),
      fc.constant("secret_api_key_12345")
    ).filter((val) => {
      const str = String(val);
      return !Object.values(SAFE_MESSAGES).includes(str);
    });

    fc.assert(
      fc.property(
        errorTypeArb,
        meaningfulNonErrorArb,
        (errorType, nonErrorValue) => {
          const result = sanitizeErrorForProduction(nonErrorValue, errorType);

          // Must still return correct status code
          if (result.statusCode !== EXPECTED_STATUS_CODES[errorType]) return false;

          // Must use the safe generic message
          if (result.error !== SAFE_MESSAGES[errorType]) return false;

          // The stringified value must not appear in the error field
          const stringified = String(nonErrorValue);
          return result.error !== stringified;
        }
      ),
      { numRuns: 200, verbose: true }
    );
  });
});
