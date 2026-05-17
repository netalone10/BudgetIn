import { NextRequest, NextResponse } from "next/server";
import { getCacheControlHeader, type CacheProfile } from "./cache-headers";
import { generateETag, shouldReturn304 } from "./etag";

/**
 * Applies the appropriate Cache-Control header to a NextResponse
 * based on the given cache profile.
 */
export function withCacheHeaders<T>(
  response: NextResponse<T>,
  profile: CacheProfile
): NextResponse<T> {
  const headerValue = getCacheControlHeader({ profile });
  response.headers.set("Cache-Control", headerValue);
  return response;
}

/**
 * Generates an ETag for the given data and sets it on the response.
 */
export function withETag<T>(
  response: NextResponse<T>,
  data: unknown
): NextResponse<T> {
  const etag = generateETag(data);
  response.headers.set("ETag", etag);
  return response;
}

/**
 * Handles conditional requests by checking the If-None-Match header
 * against the ETag of the current data.
 *
 * Returns a 304 Not Modified response if the ETags match,
 * or null if the request should continue with a full response.
 */
export function handleConditionalRequest(
  request: NextRequest,
  data: unknown
): NextResponse | null {
  const requestETag = request.headers.get("If-None-Match");
  const currentETag = generateETag(data);

  if (shouldReturn304(requestETag, currentETag)) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: currentETag,
      },
    });
  }

  return null;
}
