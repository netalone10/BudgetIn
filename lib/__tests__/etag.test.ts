import { generateETag, shouldReturn304 } from "@/lib/etag";
import { createHash } from "crypto";

describe("generateETag", () => {
  it("returns a deterministic ETag for the same data", () => {
    const data = { id: 1, name: "test" };
    const etag1 = generateETag(data);
    const etag2 = generateETag(data);
    expect(etag1).toBe(etag2);
  });

  it("returns different ETags for different data", () => {
    const etag1 = generateETag({ id: 1 });
    const etag2 = generateETag({ id: 2 });
    expect(etag1).not.toBe(etag2);
  });

  it("wraps the hash in double quotes (strong ETag format)", () => {
    const etag = generateETag({ foo: "bar" });
    expect(etag).toMatch(/^"[a-f0-9]{32}"$/);
  });

  it("produces the correct MD5 hash of JSON-serialized data", () => {
    const data = { hello: "world" };
    const expectedHash = createHash("md5")
      .update(JSON.stringify(data))
      .digest("hex");
    expect(generateETag(data)).toBe(`"${expectedHash}"`);
  });

  it("handles primitive values", () => {
    expect(generateETag(42)).toMatch(/^"[a-f0-9]{32}"$/);
    expect(generateETag("string")).toMatch(/^"[a-f0-9]{32}"$/);
    expect(generateETag(null)).toMatch(/^"[a-f0-9]{32}"$/);
    expect(generateETag(true)).toMatch(/^"[a-f0-9]{32}"$/);
  });

  it("handles arrays", () => {
    const etag = generateETag([1, 2, 3]);
    expect(etag).toMatch(/^"[a-f0-9]{32}"$/);
  });

  it("handles empty objects and arrays", () => {
    const etagObj = generateETag({});
    const etagArr = generateETag([]);
    expect(etagObj).toMatch(/^"[a-f0-9]{32}"$/);
    expect(etagArr).toMatch(/^"[a-f0-9]{32}"$/);
    expect(etagObj).not.toBe(etagArr);
  });
});

describe("shouldReturn304", () => {
  it("returns false when requestETag is null", () => {
    expect(shouldReturn304(null, '"abc123"')).toBe(false);
  });

  it("returns true when strong ETags match exactly", () => {
    const etag = '"d41d8cd98f00b204e9800998ecf8427e"';
    expect(shouldReturn304(etag, etag)).toBe(true);
  });

  it("returns false when strong ETags do not match", () => {
    expect(
      shouldReturn304('"aaa"', '"bbb"')
    ).toBe(false);
  });

  it("returns true when weak ETag matches after stripping W/ prefix", () => {
    const strongETag = '"d41d8cd98f00b204e9800998ecf8427e"';
    const weakETag = `W/${strongETag}`;
    expect(shouldReturn304(weakETag, strongETag)).toBe(true);
  });

  it("returns false when weak ETag does not match after stripping prefix", () => {
    expect(shouldReturn304('W/"aaa"', '"bbb"')).toBe(false);
  });

  it("works with generateETag output", () => {
    const data = { transactions: [{ id: 1, amount: 100 }] };
    const currentETag = generateETag(data);
    expect(shouldReturn304(currentETag, currentETag)).toBe(true);
    expect(shouldReturn304(`W/${currentETag}`, currentETag)).toBe(true);
    expect(shouldReturn304(generateETag({ different: true }), currentETag)).toBe(false);
  });
});
