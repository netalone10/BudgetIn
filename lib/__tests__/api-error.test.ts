import {
  createApiError,
  sanitizeErrorForProduction,
  type ErrorType,
} from "../api-error";

describe("createApiError", () => {
  it("maps validation to 400 with default message", () => {
    const result = createApiError("validation");
    expect(result).toEqual({
      error: "Invalid request parameters",
      code: "VALIDATION",
      statusCode: 400,
    });
  });

  it("maps unauthorized to 401 with default message", () => {
    const result = createApiError("unauthorized");
    expect(result).toEqual({
      error: "Authentication required",
      code: "UNAUTHORIZED",
      statusCode: 401,
    });
  });

  it("maps forbidden to 403 with default message", () => {
    const result = createApiError("forbidden");
    expect(result).toEqual({
      error: "Access denied",
      code: "FORBIDDEN",
      statusCode: 403,
    });
  });

  it("maps not_found to 404 with default message", () => {
    const result = createApiError("not_found");
    expect(result).toEqual({
      error: "Resource not found",
      code: "NOT_FOUND",
      statusCode: 404,
    });
  });

  it("maps internal to 500 with default message", () => {
    const result = createApiError("internal");
    expect(result).toEqual({
      error: "Internal server error",
      code: "INTERNAL",
      statusCode: 500,
    });
  });

  it("uses custom message when provided", () => {
    const result = createApiError("validation", "Email is required");
    expect(result).toEqual({
      error: "Email is required",
      code: "VALIDATION",
      statusCode: 400,
    });
  });
});

describe("sanitizeErrorForProduction", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("returns generic message in production mode", () => {
    process.env.NODE_ENV = "production";
    const error = new Error("SQL syntax error near line 42");
    const result = sanitizeErrorForProduction(error, "internal");

    expect(result.error).toBe("Internal server error");
    expect(result.statusCode).toBe(500);
    expect(result.error).not.toContain("SQL");
  });

  it("never exposes stack traces in production", () => {
    process.env.NODE_ENV = "production";
    const error = new Error("Something broke");
    error.stack = "Error: Something broke\n    at Object.<anonymous> (/app/lib/db.ts:42:5)";
    const result = sanitizeErrorForProduction(error, "internal");

    expect(JSON.stringify(result)).not.toContain("db.ts");
    expect(JSON.stringify(result)).not.toContain("stack");
    expect(result.error).toBe("Internal server error");
  });

  it("includes error message in development mode", () => {
    process.env.NODE_ENV = "development";
    const error = new Error("User not found in database");
    const result = sanitizeErrorForProduction(error, "not_found");

    expect(result.error).toBe("User not found in database");
    expect(result.statusCode).toBe(404);
  });

  it("handles non-Error objects in development", () => {
    process.env.NODE_ENV = "development";
    const result = sanitizeErrorForProduction("string error", "validation");

    expect(result.error).toBe("string error");
    expect(result.statusCode).toBe(400);
  });

  it("defaults to internal error type when not specified", () => {
    process.env.NODE_ENV = "production";
    const result = sanitizeErrorForProduction(new Error("oops"));

    expect(result.statusCode).toBe(500);
    expect(result.code).toBe("INTERNAL");
  });

  it("maps all error types to correct status codes in production", () => {
    process.env.NODE_ENV = "production";
    const expectedMappings: [ErrorType, number][] = [
      ["validation", 400],
      ["unauthorized", 401],
      ["forbidden", 403],
      ["not_found", 404],
      ["internal", 500],
    ];

    for (const [type, expectedStatus] of expectedMappings) {
      const result = sanitizeErrorForProduction(
        new Error("secret details"),
        type
      );
      expect(result.statusCode).toBe(expectedStatus);
      expect(result.error).not.toContain("secret details");
    }
  });
});
