/**
 * Unit tests for lib/sheets-data.ts
 *
 * Tests the in-memory derivation functions (month slicing, balance computation)
 * that operate on preloaded ledger data. The core getFullSheetsLedger function
 * is mocked since it depends on external Google Sheets API + React cache().
 *
 * Requirements: 8.1, 8.2, 8.3
 */

// Mock server-only (no-op in test environment)
jest.mock("server-only", () => ({}), { virtual: true });

// Mock React cache() to just pass through the function
jest.mock("react", () => ({
  cache: (fn: unknown) => fn,
}));

// Mock external dependencies
jest.mock("@/utils/token", () => ({
  getValidToken: jest.fn().mockResolvedValue("mock-access-token"),
}));

jest.mock("@/utils/sheets", () => ({
  getTransactions: jest.fn(),
  getAccounts: jest.fn(),
}));

jest.mock("@/utils/sheets-ledger", () => ({
  computeAccountBalancesFromTx: jest.fn(),
}));

jest.mock("@/lib/sheets-fallback", () => ({
  cacheSheetResponse: jest.fn(),
  handleSheetsFallback: jest.fn(),
}));

import { getTransactions, getAccounts } from "@/utils/sheets";
import { computeAccountBalancesFromTx } from "@/utils/sheets-ledger";
import { cacheSheetResponse, handleSheetsFallback } from "@/lib/sheets-fallback";

const mockGetTransactions = getTransactions as jest.MockedFunction<typeof getTransactions>;
const mockGetAccounts = getAccounts as jest.MockedFunction<typeof getAccounts>;
const mockComputeBalances = computeAccountBalancesFromTx as jest.MockedFunction<typeof computeAccountBalancesFromTx>;
const mockCacheSheetResponse = cacheSheetResponse as jest.MockedFunction<typeof cacheSheetResponse>;
const mockHandleSheetsFallback = handleSheetsFallback as jest.MockedFunction<typeof handleSheetsFallback>;

// Import after mocks are set up
import {
  getFullSheetsLedger,
  getTransactionsForMonth,
  getTransactionsForRange,
  getAllTransactions,
  getAccountBalancesFromLedger,
  getAccountsWithComputedBalance,
} from "@/lib/sheets-data";

const SAMPLE_TRANSACTIONS = [
  { id: "t1", date: "2026-01-05", time: "10:00", amount: 50000, category: "Food", note: "Lunch", created_at: "2026-01-05T10:00:00+07:00", type: "expense" as const, fromAccountId: "acc1", fromAccountName: "Cash" },
  { id: "t2", date: "2026-01-15", time: "14:00", amount: 100000, category: "Salary", note: "Monthly", created_at: "2026-01-15T14:00:00+07:00", type: "income" as const, toAccountId: "acc1", toAccountName: "Cash" },
  { id: "t3", date: "2026-02-03", time: "09:00", amount: 30000, category: "Transport", note: "Grab", created_at: "2026-02-03T09:00:00+07:00", type: "expense" as const, fromAccountId: "acc1", fromAccountName: "Cash" },
  { id: "t4", date: "2026-02-20", time: "16:00", amount: 200000, category: "Salary", note: "Bonus", created_at: "2026-02-20T16:00:00+07:00", type: "income" as const, toAccountId: "acc2", toAccountName: "Bank" },
  { id: "t5", date: "2026-03-01", time: "08:00", amount: 75000, category: "Shopping", note: "Clothes", created_at: "2026-03-01T08:00:00+07:00", type: "expense" as const, fromAccountId: "acc2", fromAccountName: "Bank" },
];

const SAMPLE_ACCOUNTS = [
  { id: "acc1", name: "Cash", type: "Cash", classification: "asset", balance: 0, currency: "IDR", color: null, note: null, tanggalSettlement: null, tanggalJatuhTempo: null },
  { id: "acc2", name: "Bank BCA", type: "Bank", classification: "asset", balance: 0, currency: "IDR", color: "#0066cc", note: null, tanggalSettlement: null, tanggalJatuhTempo: null },
];

describe("sheets-data", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTransactions.mockResolvedValue(SAMPLE_TRANSACTIONS);
    mockGetAccounts.mockResolvedValue(SAMPLE_ACCOUNTS);
  });

  describe("getFullSheetsLedger", () => {
    it("fetches transactions and accounts in parallel and returns them", async () => {
      const result = await getFullSheetsLedger("user1", "sheet1");

      expect(result.transactions).toEqual(SAMPLE_TRANSACTIONS);
      expect(result.accounts).toEqual(SAMPLE_ACCOUNTS);
    });

    it("caches successful response via cacheSheetResponse", async () => {
      await getFullSheetsLedger("user1", "sheet1");

      expect(mockCacheSheetResponse).toHaveBeenCalledWith("user1", {
        transactions: SAMPLE_TRANSACTIONS,
        accounts: SAMPLE_ACCOUNTS,
      });
    });

    it("returns fallback data on API failure", async () => {
      const error = new Error("API timeout");
      mockGetTransactions.mockRejectedValue(error);
      mockHandleSheetsFallback.mockReturnValue({
        data: { transactions: [], accounts: [] },
        isStale: false,
        error: "API timeout",
      });

      const result = await getFullSheetsLedger("user1", "sheet1");

      expect(result).toEqual({ transactions: [], accounts: [] });
      expect(mockHandleSheetsFallback).toHaveBeenCalledWith(
        "user1",
        error,
        expect.any(Function)
      );
    });

    it("returns stale cached data on API failure when available", async () => {
      const staleData = { transactions: SAMPLE_TRANSACTIONS, accounts: SAMPLE_ACCOUNTS };
      const error = new Error("Network error");
      mockGetTransactions.mockRejectedValue(error);
      mockHandleSheetsFallback.mockReturnValue({
        data: staleData,
        isStale: true,
        error: "Network error",
      });

      const result = await getFullSheetsLedger("user1", "sheet1");

      expect(result).toEqual(staleData);
    });
  });

  describe("getTransactionsForMonth", () => {
    it("filters transactions for January 2026", async () => {
      const result = await getTransactionsForMonth("user1", "sheet1", "2026-01");

      expect(result).toHaveLength(2);
      expect(result.map((t) => t.id)).toEqual(["t1", "t2"]);
    });

    it("filters transactions for February 2026", async () => {
      const result = await getTransactionsForMonth("user1", "sheet1", "2026-02");

      expect(result).toHaveLength(2);
      expect(result.map((t) => t.id)).toEqual(["t3", "t4"]);
    });

    it("filters transactions for March 2026", async () => {
      const result = await getTransactionsForMonth("user1", "sheet1", "2026-03");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("t5");
    });

    it("returns empty array for month with no transactions", async () => {
      const result = await getTransactionsForMonth("user1", "sheet1", "2026-04");

      expect(result).toEqual([]);
    });
  });

  describe("getTransactionsForRange", () => {
    it("filters transactions within a date range", async () => {
      const result = await getTransactionsForRange("user1", "sheet1", "2026-01-10", "2026-02-10");

      expect(result).toHaveLength(2);
      expect(result.map((t) => t.id)).toEqual(["t2", "t3"]);
    });

    it("includes boundary dates", async () => {
      const result = await getTransactionsForRange("user1", "sheet1", "2026-01-05", "2026-01-15");

      expect(result).toHaveLength(2);
      expect(result.map((t) => t.id)).toEqual(["t1", "t2"]);
    });

    it("returns empty array for range with no transactions", async () => {
      const result = await getTransactionsForRange("user1", "sheet1", "2025-01-01", "2025-12-31");

      expect(result).toEqual([]);
    });
  });

  describe("getAllTransactions", () => {
    it("returns all transactions from the ledger", async () => {
      const result = await getAllTransactions("user1", "sheet1");

      expect(result).toHaveLength(5);
      expect(result).toEqual(SAMPLE_TRANSACTIONS);
    });
  });

  describe("getAccountBalancesFromLedger", () => {
    it("computes balances from preloaded ledger data without extra API calls", async () => {
      const expectedBalances = new Map([["acc1", 50000], ["acc2", 125000]]);
      mockComputeBalances.mockReturnValue(expectedBalances);

      const result = await getAccountBalancesFromLedger("user1", "sheet1");

      expect(result).toEqual(expectedBalances);
      expect(mockComputeBalances).toHaveBeenCalledWith(SAMPLE_ACCOUNTS, SAMPLE_TRANSACTIONS);
    });

    it("reuses the same preloaded data (no separate API call for balances)", async () => {
      mockComputeBalances.mockReturnValue(new Map());

      await getAccountBalancesFromLedger("user1", "sheet1");

      // getTransactions and getAccounts should only be called once (by getFullSheetsLedger)
      expect(mockGetTransactions).toHaveBeenCalledTimes(1);
      expect(mockGetAccounts).toHaveBeenCalledTimes(1);
    });
  });

  describe("getAccountsWithComputedBalance", () => {
    it("returns accounts with ledger-computed balances", async () => {
      const balances = new Map([["acc1", 50000], ["acc2", 125000]]);
      mockComputeBalances.mockReturnValue(balances);

      const result = await getAccountsWithComputedBalance("user1", "sheet1");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ ...SAMPLE_ACCOUNTS[0], balance: 50000 });
      expect(result[1]).toEqual({ ...SAMPLE_ACCOUNTS[1], balance: 125000 });
    });

    it("defaults to 0 balance for accounts not in the balance map", async () => {
      const balances = new Map([["acc1", 50000]]);
      mockComputeBalances.mockReturnValue(balances);

      const result = await getAccountsWithComputedBalance("user1", "sheet1");

      expect(result[1].balance).toBe(0);
    });

    it("does not make separate API calls for balance computation", async () => {
      mockComputeBalances.mockReturnValue(new Map());

      await getAccountsWithComputedBalance("user1", "sheet1");

      // Only one call to each — from getFullSheetsLedger
      expect(mockGetTransactions).toHaveBeenCalledTimes(1);
      expect(mockGetAccounts).toHaveBeenCalledTimes(1);
    });
  });
});
