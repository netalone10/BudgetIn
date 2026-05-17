import { createHash } from "crypto";

/**
 * Generates a strong ETag for the given data by computing an MD5 hash
 * of its JSON representation.
 */
export function generateETag(data: unknown): string {
  const hash = createHash("md5")
    .update(JSON.stringify(data))
    .digest("hex");
  return `"${hash}"`;
}

/**
 * Determines whether a 304 Not Modified response should be returned
 * by comparing the request's If-None-Match ETag against the current ETag.
 * Handles both strong and weak ETag comparison (strips W/ prefix).
 */
export function shouldReturn304(
  requestETag: string | null,
  currentETag: string
): boolean {
  if (!requestETag) return false;
  // Handle both strong and weak ETags by stripping the weak validator prefix
  const normalized = requestETag.replace(/^W\//, "");
  return normalized === currentETag;
}
