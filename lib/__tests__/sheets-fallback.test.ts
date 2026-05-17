import {
  handleSheetsFallback,
  cacheSheetResponse,
} from "@/lib/sheets-fallback";

describe("sheets-fallback", () => {
  beforeEach(() => {
    // Clear the module cache to reset the in-memory sheetsCache between tests
    jest.resetModules();
  });

  describe("handleSheetsFallback", () => {
    it("returns empty data from factory when no cache exists", () => {
      const result = handleSheetsFallback(
        "user-no-cache",
        new Error("API timeout"),
        () => []
      );

      expect(result).toEqual({
        data: [],
        isStale: false,
        error: "API timeout",
      });
    });

    it("returns stale cached data when cache entry is within TTL", () => {
      const cachedData = [{ id: 1, amount: 100 }];
      cacheSheetResponse("user-with-cache", cachedData);

      const result = handleSheetsFallback(
        "user-with-cache",
        new Error("Network error"),
        () => []
      );

      expect(result).toEqual({
        data: cachedData,
        isStale: true,
        error: "Network error",
      });
    });

    it("returns empty data from factory when cache entry has expired", () => {
      const cachedData = [{ id: 1, amount: 100 }];
      cacheSheetResponse("user-expired", cachedData);

      // Advance time past the 5-minute TTL
      const originalNow = Date.now;
      Date.now = () => originalNow() + 5 * 60 * 1000 + 1;

      const result = handleSheetsFallback(
        "user-expired",
        new Error("API error"),
        () => []
      );

      expect(result).toEqual({
        data: [],
        isStale: false,
        error: "API error",
      });

      Date.now = originalNow;
    });

    it("uses generic error message for non-Error objects", () => {
      const result = handleSheetsFallback(
        "user-generic-error",
        "some string error",
        () => ({})
      );

      expect(result).toEqual({
        data: {},
        isStale: false,
        error: "Google Sheets API error",
      });
    });

    it("uses generic error message for non-Error objects with cached data", () => {
      cacheSheetResponse("user-generic-cached", { transactions: [] });

      const result = handleSheetsFallback(
        "user-generic-cached",
        { code: 500 },
        () => ({ transactions: [] })
      );

      expect(result).toEqual({
        data: { transactions: [] },
        isStale: true,
        error: "Google Sheets API error",
      });
    });

    it("returns data from emptyDataFactory with correct type", () => {
      const result = handleSheetsFallback(
        "user-typed",
        new Error("fail"),
        () => ({ transactions: [], total: 0 })
      );

      expect(result.data).toEqual({ transactions: [], total: 0 });
      expect(result.isStale).toBe(false);
      expect(result.error).toBe("fail");
    });
  });

  describe("cacheSheetResponse", () => {
    it("stores data that can be retrieved by handleSheetsFallback", () => {
      const data = { rows: [1, 2, 3] };
      cacheSheetResponse("user-store", data);

      const result = handleSheetsFallback(
        "user-store",
        new Error("oops"),
        () => ({ rows: [] })
      );

      expect(result.data).toEqual(data);
      expect(result.isStale).toBe(true);
    });

    it("overwrites previous cache entry for the same user", () => {
      cacheSheetResponse("user-overwrite", { version: 1 });
      cacheSheetResponse("user-overwrite", { version: 2 });

      const result = handleSheetsFallback(
        "user-overwrite",
        new Error("err"),
        () => ({ version: 0 })
      );

      expect(result.data).toEqual({ version: 2 });
    });

    it("maintains separate cache entries per user", () => {
      cacheSheetResponse("user-a", { name: "A" });
      cacheSheetResponse("user-b", { name: "B" });

      const resultA = handleSheetsFallback(
        "user-a",
        new Error("err"),
        () => ({})
      );
      const resultB = handleSheetsFallback(
        "user-b",
        new Error("err"),
        () => ({})
      );

      expect(resultA.data).toEqual({ name: "A" });
      expect(resultB.data).toEqual({ name: "B" });
    });
  });
});
