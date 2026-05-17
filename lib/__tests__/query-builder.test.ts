import {
  buildTransactionQuery,
  TRANSACTION_SELECT_FIELDS,
} from "@/lib/query-builder";

describe("buildTransactionQuery", () => {
  it("builds a query with correct date range for a standard month", () => {
    const result = buildTransactionQuery({
      userId: "user-1",
      month: "2024-03",
    });

    expect(result.where.userId).toBe("user-1");
    expect(result.where.date).toEqual({ gte: "2024-03-01", lte: "2024-03-31" });
  });

  it("computes correct last day for February in a leap year", () => {
    const result = buildTransactionQuery({
      userId: "user-1",
      month: "2024-02",
    });

    expect(result.where.date).toEqual({ gte: "2024-02-01", lte: "2024-02-29" });
  });

  it("computes correct last day for February in a non-leap year", () => {
    const result = buildTransactionQuery({
      userId: "user-1",
      month: "2023-02",
    });

    expect(result.where.date).toEqual({ gte: "2023-02-01", lte: "2023-02-28" });
  });

  it("computes correct last day for a 30-day month", () => {
    const result = buildTransactionQuery({
      userId: "user-1",
      month: "2024-04",
    });

    expect(result.where.date).toEqual({ gte: "2024-04-01", lte: "2024-04-30" });
  });

  it("includes accountId filter when provided", () => {
    const result = buildTransactionQuery({
      userId: "user-1",
      month: "2024-01",
      accountId: "acc-123",
    });

    expect(result.where.accountId).toBe("acc-123");
  });

  it("includes type filter when provided", () => {
    const result = buildTransactionQuery({
      userId: "user-1",
      month: "2024-01",
      type: "expense",
    });

    expect(result.where.type).toBe("expense");
  });

  it("does not include accountId or type when not provided", () => {
    const result = buildTransactionQuery({
      userId: "user-1",
      month: "2024-01",
    });

    expect(result.where).not.toHaveProperty("accountId");
    expect(result.where).not.toHaveProperty("type");
  });

  it("uses TRANSACTION_SELECT_FIELDS for field selection", () => {
    const result = buildTransactionQuery({
      userId: "user-1",
      month: "2024-01",
    });

    expect(result.select).toEqual(TRANSACTION_SELECT_FIELDS);
  });

  it("enforces take: 200", () => {
    const result = buildTransactionQuery({
      userId: "user-1",
      month: "2024-01",
    });

    expect(result.take).toBe(200);
  });

  it("orders by date descending", () => {
    const result = buildTransactionQuery({
      userId: "user-1",
      month: "2024-01",
    });

    expect(result.orderBy).toEqual({ date: "desc" });
  });

  it("handles December correctly (month 12)", () => {
    const result = buildTransactionQuery({
      userId: "user-1",
      month: "2024-12",
    });

    expect(result.where.date).toEqual({ gte: "2024-12-01", lte: "2024-12-31" });
  });

  it("handles January correctly (month 01)", () => {
    const result = buildTransactionQuery({
      userId: "user-1",
      month: "2024-01",
    });

    expect(result.where.date).toEqual({ gte: "2024-01-01", lte: "2024-01-31" });
  });
});
