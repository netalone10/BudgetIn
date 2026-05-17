import fc from "fast-check";
import {
  buildTransactionQuery,
  TRANSACTION_SELECT_FIELDS,
} from "@/lib/query-builder";

/**
 * Property 3: Transaction Query Builder Date Range Correctness
 *
 * For any valid month string in YYYY-MM format, the buildTransactionQuery function
 * SHALL produce a query with a date filter whose gte value is the first day of that
 * month and whose lte value is the last day of that month, and SHALL include only
 * the fields defined in TRANSACTION_SELECT_FIELDS.
 *
 * **Validates: Requirements 6.1**
 */

/**
 * Generator for valid YYYY-MM month strings.
 * Years range from 1970 to 2099, months from 01 to 12.
 */
const validMonthArb = fc
  .record({
    year: fc.integer({ min: 1970, max: 2099 }),
    month: fc.integer({ min: 1, max: 12 }),
  })
  .map(({ year, month }) => `${year}-${String(month).padStart(2, "0")}`);

/**
 * Helper: compute the expected last day of a given year/month.
 * Uses the standard Date trick: day 0 of the next month = last day of current month.
 */
function expectedLastDay(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

describe("Property 3: Transaction Query Builder Date Range Correctness", () => {
  describe("date range boundaries", () => {
    it("gte is always the first day of the month (YYYY-MM-01)", () => {
      fc.assert(
        fc.property(validMonthArb, (monthStr) => {
          const result = buildTransactionQuery({
            userId: "test-user",
            month: monthStr,
          });
          const dateFilter = result.where.date as { gte: string; lte: string };
          return dateFilter.gte === `${monthStr}-01`;
        }),
        { numRuns: 1000 }
      );
    });

    it("lte is always the last day of the month", () => {
      fc.assert(
        fc.property(validMonthArb, (monthStr) => {
          const [year, month] = monthStr.split("-").map(Number);
          const lastDay = expectedLastDay(year, month);
          const expectedEnd = `${monthStr}-${String(lastDay).padStart(2, "0")}`;

          const result = buildTransactionQuery({
            userId: "test-user",
            month: monthStr,
          });
          const dateFilter = result.where.date as { gte: string; lte: string };
          return dateFilter.lte === expectedEnd;
        }),
        { numRuns: 1000 }
      );
    });

    it("lte day is between 28 and 31 inclusive for any valid month", () => {
      fc.assert(
        fc.property(validMonthArb, (monthStr) => {
          const result = buildTransactionQuery({
            userId: "test-user",
            month: monthStr,
          });
          const dateFilter = result.where.date as { gte: string; lte: string };
          const dayStr = dateFilter.lte.split("-")[2];
          const day = parseInt(dayStr, 10);
          return day >= 28 && day <= 31;
        }),
        { numRuns: 1000 }
      );
    });

    it("gte date is always before or equal to lte date", () => {
      fc.assert(
        fc.property(validMonthArb, (monthStr) => {
          const result = buildTransactionQuery({
            userId: "test-user",
            month: monthStr,
          });
          const dateFilter = result.where.date as { gte: string; lte: string };
          return dateFilter.gte <= dateFilter.lte;
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe("select fields", () => {
    it("select always matches TRANSACTION_SELECT_FIELDS exactly", () => {
      fc.assert(
        fc.property(validMonthArb, (monthStr) => {
          const result = buildTransactionQuery({
            userId: "test-user",
            month: monthStr,
          });
          const selectKeys = Object.keys(result.select).sort();
          const expectedKeys = Object.keys(TRANSACTION_SELECT_FIELDS).sort();
          return (
            selectKeys.length === expectedKeys.length &&
            selectKeys.every((key, i) => key === expectedKeys[i]) &&
            Object.values(result.select).every((v) => v === true)
          );
        }),
        { numRuns: 1000 }
      );
    });
  });
});
