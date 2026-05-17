import { NextRequest, NextResponse } from "next/server";
import { withCacheHeaders, withETag, handleConditionalRequest } from "@/lib/api-helpers";
import { generateETag } from "@/lib/etag";

describe("withCacheHeaders", () => {
  it("sets Cache-Control header for static profile", () => {
    const response = NextResponse.json({ data: "test" });
    const result = withCacheHeaders(response, "static");

    expect(result.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable"
    );
  });

  it("sets Cache-Control header for semi-static profile", () => {
    const response = NextResponse.json({ data: "test" });
    const result = withCacheHeaders(response, "semi-static");

    expect(result.headers.get("Cache-Control")).toBe(
      "public, s-maxage=60, stale-while-revalidate=300"
    );
  });

  it("sets Cache-Control header for private-mutable profile", () => {
    const response = NextResponse.json({ data: "test" });
    const result = withCacheHeaders(response, "private-mutable");

    expect(result.headers.get("Cache-Control")).toBe("private, no-cache");
  });

  it("returns the same response object (mutates in place)", () => {
    const response = NextResponse.json({ data: "test" });
    const result = withCacheHeaders(response, "static");

    expect(result).toBe(response);
  });
});

describe("withETag", () => {
  it("sets ETag header on the response", () => {
    const data = { id: 1, name: "test" };
    const response = NextResponse.json(data);
    const result = withETag(response, data);

    const expectedETag = generateETag(data);
    expect(result.headers.get("ETag")).toBe(expectedETag);
  });

  it("generates a quoted ETag value", () => {
    const data = { items: [1, 2, 3] };
    const response = NextResponse.json(data);
    const result = withETag(response, data);

    const etag = result.headers.get("ETag");
    expect(etag).toMatch(/^"[a-f0-9]+"$/);
  });

  it("returns the same response object (mutates in place)", () => {
    const response = NextResponse.json({ data: "test" });
    const result = withETag(response, { data: "test" });

    expect(result).toBe(response);
  });
});

describe("handleConditionalRequest", () => {
  it("returns 304 response when If-None-Match matches current ETag", () => {
    const data = { id: 1, name: "test" };
    const currentETag = generateETag(data);
    const request = new NextRequest("http://localhost/api/test", {
      headers: { "If-None-Match": currentETag },
    });

    const result = handleConditionalRequest(request, data);

    expect(result).not.toBeNull();
    expect(result!.status).toBe(304);
  });

  it("includes ETag header in 304 response", () => {
    const data = { id: 1, name: "test" };
    const currentETag = generateETag(data);
    const request = new NextRequest("http://localhost/api/test", {
      headers: { "If-None-Match": currentETag },
    });

    const result = handleConditionalRequest(request, data);

    expect(result!.headers.get("ETag")).toBe(currentETag);
  });

  it("returns null when If-None-Match does not match", () => {
    const data = { id: 1, name: "test" };
    const request = new NextRequest("http://localhost/api/test", {
      headers: { "If-None-Match": '"stale-etag-value"' },
    });

    const result = handleConditionalRequest(request, data);

    expect(result).toBeNull();
  });

  it("returns null when no If-None-Match header is present", () => {
    const data = { id: 1, name: "test" };
    const request = new NextRequest("http://localhost/api/test");

    const result = handleConditionalRequest(request, data);

    expect(result).toBeNull();
  });

  it("handles weak ETag prefix (W/) in If-None-Match", () => {
    const data = { id: 1, name: "test" };
    const currentETag = generateETag(data);
    const request = new NextRequest("http://localhost/api/test", {
      headers: { "If-None-Match": `W/${currentETag}` },
    });

    const result = handleConditionalRequest(request, data);

    expect(result).not.toBeNull();
    expect(result!.status).toBe(304);
  });

  it("304 response has no body", () => {
    const data = { id: 1, name: "test" };
    const currentETag = generateETag(data);
    const request = new NextRequest("http://localhost/api/test", {
      headers: { "If-None-Match": currentETag },
    });

    const result = handleConditionalRequest(request, data);

    expect(result!.body).toBeNull();
  });
});
