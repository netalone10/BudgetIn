import { normalizePaginationParams, paginateArray } from "@/lib/pagination";

describe("normalizePaginationParams", () => {
  it("returns defaults when no params provided", () => {
    const result = normalizePaginationParams({});
    expect(result).toEqual({ page: 1, limit: 50, skip: 0 });
  });

  it("uses provided page and limit", () => {
    const result = normalizePaginationParams({ page: 3, limit: 20 });
    expect(result).toEqual({ page: 3, limit: 20, skip: 40 });
  });

  it("enforces minimum page of 1", () => {
    const result = normalizePaginationParams({ page: 0 });
    expect(result.page).toBe(1);

    const result2 = normalizePaginationParams({ page: -5 });
    expect(result2.page).toBe(1);
  });

  it("enforces minimum limit of 1", () => {
    const result = normalizePaginationParams({ limit: 0 });
    expect(result.limit).toBe(1);

    const result2 = normalizePaginationParams({ limit: -10 });
    expect(result2.limit).toBe(1);
  });

  it("enforces maximum limit of 200", () => {
    const result = normalizePaginationParams({ limit: 500 });
    expect(result.limit).toBe(200);

    const result2 = normalizePaginationParams({ limit: 201 });
    expect(result2.limit).toBe(200);
  });

  it("calculates skip correctly", () => {
    const result = normalizePaginationParams({ page: 4, limit: 25 });
    expect(result.skip).toBe(75);
  });
});

describe("paginateArray", () => {
  const items = Array.from({ length: 120 }, (_, i) => i + 1);

  it("returns first page with default limit", () => {
    const result = paginateArray(items, {});
    expect(result.data).toHaveLength(50);
    expect(result.data[0]).toBe(1);
    expect(result.data[49]).toBe(50);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 50,
      total: 120,
      totalPages: 3,
    });
  });

  it("returns correct page slice", () => {
    const result = paginateArray(items, { page: 2, limit: 30 });
    expect(result.data).toHaveLength(30);
    expect(result.data[0]).toBe(31);
    expect(result.data[29]).toBe(60);
    expect(result.pagination).toEqual({
      page: 2,
      limit: 30,
      total: 120,
      totalPages: 4,
    });
  });

  it("returns partial last page", () => {
    const result = paginateArray(items, { page: 3, limit: 50 });
    expect(result.data).toHaveLength(20);
    expect(result.data[0]).toBe(101);
    expect(result.data[19]).toBe(120);
    expect(result.pagination.totalPages).toBe(3);
  });

  it("returns empty data for page beyond total", () => {
    const result = paginateArray(items, { page: 10, limit: 50 });
    expect(result.data).toHaveLength(0);
    expect(result.pagination.total).toBe(120);
  });

  it("handles empty array", () => {
    const result = paginateArray([], {});
    expect(result.data).toHaveLength(0);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 0,
    });
  });

  it("respects max limit of 200", () => {
    const largeArray = Array.from({ length: 500 }, (_, i) => i);
    const result = paginateArray(largeArray, { limit: 999 });
    expect(result.data).toHaveLength(200);
    expect(result.pagination.limit).toBe(200);
  });
});
