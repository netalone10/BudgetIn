export interface ApiErrorResponse {
  error: string;
  code: string;
  statusCode: number;
}

export type ErrorType =
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "internal";

const STATUS_MAP: Record<ErrorType, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  internal: 500,
};

const MESSAGE_MAP: Record<ErrorType, string> = {
  validation: "Invalid request parameters",
  unauthorized: "Authentication required",
  forbidden: "Access denied",
  not_found: "Resource not found",
  internal: "Internal server error",
};

export function createApiError(
  type: ErrorType,
  customMessage?: string
): ApiErrorResponse {
  return {
    error: customMessage ?? MESSAGE_MAP[type],
    code: type.toUpperCase(),
    statusCode: STATUS_MAP[type],
  };
}

export function sanitizeErrorForProduction(
  error: unknown,
  type: ErrorType = "internal"
): ApiErrorResponse {
  // Never expose stack traces or internal details in production
  if (process.env.NODE_ENV === "production") {
    return createApiError(type);
  }
  // In development, include the error message (but never the stack)
  const message = error instanceof Error ? error.message : String(error);
  return createApiError(type, message);
}
