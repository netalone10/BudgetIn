/**
 * Unit tests for `lib/details-data.ts` covering edge cases around
 * `aggregateDetails`, `applyDetailsFilters`, and `toggleExpand`.
 *
 * Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.7, 5.1, 5.2, 5.3, 5.4, 5.5,
 * 5.6, 5.7, 5.10, 5.11, 5.12, 5.13, 5.14, 5.15, 6.4
 */

import {
  aggregateDetails,
  applyDetailsFilters,
  toggleExpand,
  EMPTY_EXPANDED_KEYS,
  type DetailsFilters,
} from "@/lib/details-data";
import type { ReportTransactionLike } from "@/lib/report-data";

// ---------------------------------------------------------------------------
// Test fixtures / helpers
// ---------------------------------------------------------------------------

type Tx = ReportTransactionLike & {
  id?: string;
  note?: string | null;
  time?: string | null;
  accountId?: string | null;
};

const baseFilters: DetailsFilters = {
  period: "month",
  customFrom: "",
  customTo: "",
  searchQuery: "",
  accountFilter: "",
  categoryFilter: "",
};

// Snapshot a transaction list so we can assert no mutation happened.
function snapshot(txs: Tx[]): string {
  return JSON.stringify(txs);
}

// ---------------------------------------------------------------------------
// aggregateDetails
// ---------------------------------------------------------------------------

describe("aggregateDetails — empty input", () => {
  it("returns all-zero result for empty transaction array", () => {
    const result = aggregateDetails([], new Set<string>());

    expect(result).toEqual({
      incomeGroups: [],
      expenseGroups: [],
      incomeTotal: 0,
      expenseTotal: 0,
    });
  });

  it("returns all-zero result when every transaction is filtered out", () => {
    const txs: Tx[] = [
      { date: "2026-01-01", category: "Saldo Awal", amount: 5_000_000, type: "income" },
      { date: "2026-01-02", category: "Makan", amount: 0, type: "expense" },
      // transfer principal — non-income, isExpenseTransaction → false
      {
        date: "2026-01-03",
        category: "Transfer",
        amount: 1_000_000,
        type: "transfer_out",
        fromAccountId: "bca",
        toAccountId: "mandiri",
      },
    ];

    const result = aggregateDetails(txs, new Set<string>());

    expect(result.incomeGroups).toEqual([]);
    expect(result.expenseGroups).toEqual([]);
    expect(result.incomeTotal).toBe(0);
    expect(result.expenseTotal).toBe(0);
  });
});

describe("aggregateDetails — mixed income/expense/transfer/savings/Saldo Awal", () => {
  it("filters Saldo Awal, transfer principal, savings; keeps income & non-savings expense", () => {
    const txs: Tx[] = [
      // Income — kept
      { date: "2026-01-15", category: "Gaji", amount: 10_000_000, type: "income" },
      { date: "2026-01-20", category: "Bonus", amount: 1_500_000, type: "income" },

      // Expenses — kept (non-savings, non-transfer)
      { date: "2026-01-05", category: "Makan", amount: 250_000, type: "expense" },
      { date: "2026-01-10", category: "Makan", amount: 350_000, type: "expense" },
      { date: "2026-01-12", category: "Transport", amount: 100_000, type: "expense" },

      // Saldo Awal — skipped
      { date: "2026-01-01", category: "Saldo Awal", amount: 50_000_000, type: "income" },
      { date: "2026-01-01", category: "Saldo Awal", amount: 20_000_000, type: "expense" },

      // Savings via keyword — skipped from expense
      { date: "2026-01-18", category: "Tabungan", amount: 2_000_000, type: "expense" },
      { date: "2026-01-22", category: "Investasi", amount: 1_000_000, type: "expense" },

      // Savings via savingsCategoryNames flag — skipped (no keyword match)
      { date: "2026-01-25", category: "MyAlloc", amount: 500_000, type: "expense" },

      // Transfer principal — skipped (non-income, !isExpenseTransaction)
      {
        date: "2026-01-08",
        category: "Transfer",
        amount: 1_000_000,
        type: "transfer_out",
        fromAccountId: "bca",
        toAccountId: "mandiri",
      },
      {
        date: "2026-01-08",
        category: "Transfer",
        amount: 1_000_000,
        type: "transfer_in",
        fromAccountId: "bca",
        toAccountId: "mandiri",
      },

      // Zero-amount — skipped
      { date: "2026-01-30", category: "Makan", amount: 0, type: "expense" },
    ];

    const before = snapshot(txs);
    const result = aggregateDetails(txs, new Set(["myalloc"]));

    // Income side
    expect(result.incomeTotal).toBe(11_500_000);
    expect(result.incomeGroups).toHaveLength(2);
    expect(result.incomeGroups.map((g) => g.category)).toEqual(["Gaji", "Bonus"]);
    expect(result.incomeGroups[0].amount).toBe(10_000_000);
    expect(result.incomeGroups[1].amount).toBe(1_500_000);

    // Expense side — only Makan + Transport survive
    expect(result.expenseTotal).toBe(700_000);
    expect(result.expenseGroups).toHaveLength(2);
    expect(result.expenseGroups.map((g) => g.category)).toEqual(["Makan", "Transport"]);
    expect(result.expenseGroups[0].amount).toBe(600_000);
    expect(result.expenseGroups[0].count).toBe(2);
    expect(result.expenseGroups[0].transactions).toHaveLength(2);
    expect(result.expenseGroups[1].amount).toBe(100_000);
    expect(result.expenseGroups[1].count).toBe(1);

    // No excluded categories leak through
    const allCats = [
      ...result.incomeGroups.map((g) => g.category),
      ...result.expenseGroups.map((g) => g.category),
    ];
    expect(allCats).not.toContain("Saldo Awal");
    expect(allCats).not.toContain("Tabungan");
    expect(allCats).not.toContain("Investasi");
    expect(allCats).not.toContain("MyAlloc");
    expect(allCats).not.toContain("Transfer");

    // Share normalisation
    const incomeShareSum = result.incomeGroups.reduce((s, g) => s + g.share, 0);
    const expenseShareSum = result.expenseGroups.reduce((s, g) => s + g.share, 0);
    expect(Math.abs(incomeShareSum - 1)).toBeLessThan(0.01);
    expect(Math.abs(expenseShareSum - 1)).toBeLessThan(0.01);

    // count === transactions.length invariant
    for (const g of [...result.incomeGroups, ...result.expenseGroups]) {
      expect(g.count).toBe(g.transactions.length);
    }

    // Input must not be mutated
    expect(snapshot(txs)).toBe(before);
  });

  it("excludes savings categories from expense even when they have explicit type='expense'", () => {
    const txs: Tx[] = [
      { date: "2026-02-01", category: "Tabungan Darurat", amount: 500_000, type: "expense" },
      { date: "2026-02-02", category: "Reksa Dana", amount: 300_000, type: "expense" },
      { date: "2026-02-03", category: "Makan", amount: 100_000, type: "expense" },
    ];

    const result = aggregateDetails(txs, new Set<string>());

    expect(result.expenseTotal).toBe(100_000);
    expect(result.expenseGroups).toHaveLength(1);
    expect(result.expenseGroups[0].category).toBe("Makan");
  });
});

describe("aggregateDetails — floating-point amounts", () => {
  it("accumulates fractional amounts and preserves total invariance within tolerance", () => {
    const txs: Tx[] = [
      { date: "2026-03-01", category: "Makan", amount: 1234.567, type: "expense" },
      { date: "2026-03-02", category: "Makan", amount: 0.1, type: "expense" },
      { date: "2026-03-03", category: "Makan", amount: 0.2, type: "expense" },
      { date: "2026-03-04", category: "Transport", amount: 99.99, type: "expense" },
      { date: "2026-03-05", category: "Gaji", amount: 5000.5, type: "income" },
    ];

    const result = aggregateDetails(txs, new Set<string>());

    // Expense bucket: Makan = 1234.567 + 0.1 + 0.2; Transport = 99.99
    const makan = result.expenseGroups.find((g) => g.category === "Makan");
    const transport = result.expenseGroups.find((g) => g.category === "Transport");
    expect(makan).toBeDefined();
    expect(transport).toBeDefined();

    // Floating math: 0.1 + 0.2 !== 0.3, so use tolerance.
    expect(Math.abs(makan!.amount - (1234.567 + 0.1 + 0.2))).toBeLessThan(1e-9);
    expect(transport!.amount).toBeCloseTo(99.99, 5);

    // Total invariance: |expenseTotal - sum(group.amount)| < 0.01
    const expenseSum = result.expenseGroups.reduce((s, g) => s + g.amount, 0);
    expect(Math.abs(result.expenseTotal - expenseSum)).toBeLessThan(0.01);

    // Income bucket
    expect(result.incomeTotal).toBeCloseTo(5000.5, 5);
    expect(result.incomeGroups).toHaveLength(1);
    expect(result.incomeGroups[0].amount).toBeCloseTo(5000.5, 5);

    // Share normalisation within tolerance even with floats
    const expenseShareSum = result.expenseGroups.reduce((s, g) => s + g.share, 0);
    expect(Math.abs(expenseShareSum - 1)).toBeLessThan(0.01);
  });

  it("nets negative amounts (refund mengurangi pengeluaran)", () => {
    const txs: Tx[] = [
      { date: "2026-03-09", category: "Makan", amount: 500, type: "expense" },
      // Refund/koreksi negatif → mengurangi total kategori Makan secara net.
      { date: "2026-03-10", category: "Makan", amount: -150.25, type: "expense" },
    ];

    const result = aggregateDetails(txs, new Set<string>());

    expect(result.expenseGroups).toHaveLength(1);
    expect(result.expenseGroups[0].amount).toBeCloseTo(500 - 150.25, 5);
    expect(result.expenseGroups[0].count).toBe(2);
    expect(result.expenseTotal).toBeCloseTo(500 - 150.25, 5);
  });
});

describe("aggregateDetails — same-amount tie-break by category", () => {
  it("orders equal-amount groups ascending by category name", () => {
    const txs: Tx[] = [
      { date: "2026-04-01", category: "Zebra", amount: 100_000, type: "expense" },
      { date: "2026-04-02", category: "Apple", amount: 100_000, type: "expense" },
      { date: "2026-04-03", category: "Mango", amount: 100_000, type: "expense" },
      // A larger one to ensure primary sort still wins
      { date: "2026-04-04", category: "Boba", amount: 500_000, type: "expense" },
    ];

    const result = aggregateDetails(txs, new Set<string>());

    expect(result.expenseGroups.map((g) => g.category)).toEqual([
      "Boba", // 500k — primary sort by amount DESC
      "Apple", // 100k — tie-break ASC
      "Mango", // 100k
      "Zebra", // 100k
    ]);
  });

  it("orders income groups identically (desc by amount, asc by category)", () => {
    const txs: Tx[] = [
      { date: "2026-04-05", category: "Bonus", amount: 1_000_000, type: "income" },
      { date: "2026-04-06", category: "Gaji", amount: 1_000_000, type: "income" },
      { date: "2026-04-07", category: "Investasi Cair", amount: 5_000_000, type: "income" },
    ];

    const result = aggregateDetails(txs, new Set<string>());

    expect(result.incomeGroups.map((g) => g.category)).toEqual([
      "Investasi Cair",
      "Bonus",
      "Gaji",
    ]);
  });
});

describe("aggregateDetails — share & sort invariants", () => {
  it("sets share to 0 when grand total is zero", () => {
    // No income/expense transactions at all → both totals are 0
    const result = aggregateDetails([], new Set<string>());

    expect(result.incomeTotal).toBe(0);
    expect(result.expenseTotal).toBe(0);
    expect(result.incomeGroups.every((g) => g.share === 0)).toBe(true);
    expect(result.expenseGroups.every((g) => g.share === 0)).toBe(true);
  });

  it("sorts each group's transactions descending by date+time", () => {
    const txs: Tx[] = [
      { date: "2026-05-01", time: "09:00", category: "Makan", amount: 100, type: "expense" },
      { date: "2026-05-03", time: "12:30", category: "Makan", amount: 200, type: "expense" },
      { date: "2026-05-02", time: "08:00", category: "Makan", amount: 150, type: "expense" },
      { date: "2026-05-03", time: "08:00", category: "Makan", amount: 50, type: "expense" },
    ];

    const result = aggregateDetails(txs, new Set<string>());

    expect(result.expenseGroups).toHaveLength(1);
    const dates = result.expenseGroups[0].transactions.map((t) => `${t.date}T${t.time ?? "00:00"}`);
    expect(dates).toEqual([
      "2026-05-03T12:30",
      "2026-05-03T08:00",
      "2026-05-02T08:00",
      "2026-05-01T09:00",
    ]);
  });

  it("does not mutate input array or its elements", () => {
    const txs: Tx[] = [
      { date: "2026-06-01", category: "Makan", amount: 100, type: "expense" },
      { date: "2026-06-02", category: "Gaji", amount: 5_000, type: "income" },
    ];
    const before = snapshot(txs);
    const txRefs = txs.map((t) => t);

    aggregateDetails(txs, new Set<string>());

    expect(snapshot(txs)).toBe(before);
    // Reference identity preserved — we did not rebuild the array.
    txRefs.forEach((ref, i) => expect(txs[i]).toBe(ref));
  });
});

// ---------------------------------------------------------------------------
// applyDetailsFilters
// ---------------------------------------------------------------------------

describe("applyDetailsFilters — AND semantics across filters", () => {
  const txs: Tx[] = [
    {
      id: "1",
      date: "2026-07-01",
      category: "Makan",
      amount: 100,
      type: "expense",
      note: "Nasi padang",
      accountId: "bca",
    },
    {
      id: "2",
      date: "2026-07-02",
      category: "Transport",
      amount: 50,
      type: "expense",
      note: "Grab ke kantor",
      accountId: "bca",
    },
    {
      id: "3",
      date: "2026-07-03",
      category: "Makan",
      amount: 75,
      type: "expense",
      note: "Sushi",
      accountId: "mandiri",
    },
    {
      id: "4",
      date: "2026-07-04",
      category: "Gaji",
      amount: 5_000,
      type: "income",
      note: "Payroll",
      accountId: "bca",
    },
    {
      id: "5",
      date: "2026-07-05",
      category: "Transfer",
      amount: 1_000,
      type: "transfer_out",
      note: "Top up Mandiri",
      fromAccountId: "bca",
      toAccountId: "mandiri",
      accountId: null,
    },
  ];

  it("returns all transactions when no filter is active", () => {
    const result = applyDetailsFilters(txs, baseFilters);
    expect(result).toHaveLength(txs.length);
    // Order preserved
    expect(result.map((t) => t.id)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("filters by accountFilter, matching accountId, fromAccountId, or toAccountId", () => {
    const fromBca = applyDetailsFilters(txs, { ...baseFilters, accountFilter: "bca" });
    expect(fromBca.map((t) => t.id)).toEqual(["1", "2", "4", "5"]);

    const fromMandiri = applyDetailsFilters(txs, { ...baseFilters, accountFilter: "mandiri" });
    // tx 3 via accountId, tx 5 via toAccountId
    expect(fromMandiri.map((t) => t.id)).toEqual(["3", "5"]);
  });

  it("filters by categoryFilter (exact match)", () => {
    const result = applyDetailsFilters(txs, { ...baseFilters, categoryFilter: "Makan" });
    expect(result.map((t) => t.id)).toEqual(["1", "3"]);
  });

  it("filters by searchQuery on note + category, case-insensitive and trimmed", () => {
    const result = applyDetailsFilters(txs, { ...baseFilters, searchQuery: "  GRAB  " });
    expect(result.map((t) => t.id)).toEqual(["2"]);

    // matches against category text too
    const cat = applyDetailsFilters(txs, { ...baseFilters, searchQuery: "makan" });
    expect(cat.map((t) => t.id)).toEqual(["1", "3"]);
  });

  it("ignores searchQuery when it is whitespace-only", () => {
    const result = applyDetailsFilters(txs, { ...baseFilters, searchQuery: "   " });
    expect(result).toHaveLength(txs.length);
  });

  it("combines all three filters with AND semantics", () => {
    const result = applyDetailsFilters(txs, {
      ...baseFilters,
      accountFilter: "bca",
      categoryFilter: "Makan",
      searchQuery: "padang",
    });
    expect(result.map((t) => t.id)).toEqual(["1"]);

    // No transaction matches all three — empty result
    const none = applyDetailsFilters(txs, {
      ...baseFilters,
      accountFilter: "bca",
      categoryFilter: "Makan",
      searchQuery: "sushi",
    });
    expect(none).toEqual([]);
  });

  it("preserves relative input order", () => {
    const reversed: Tx[] = [...txs].reverse();
    const result = applyDetailsFilters(reversed, { ...baseFilters, accountFilter: "bca" });
    // Reversed iteration order: tx5 (matches via fromAccountId), tx4, tx2, tx1.
    expect(result.map((t) => t.id)).toEqual(["5", "4", "2", "1"]);
  });

  it("does not mutate input array or elements", () => {
    const before = snapshot(txs);
    applyDetailsFilters(txs, {
      ...baseFilters,
      accountFilter: "bca",
      categoryFilter: "Makan",
      searchQuery: "padang",
    });
    expect(snapshot(txs)).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// toggleExpand
// ---------------------------------------------------------------------------

describe("toggleExpand", () => {
  it("adds category when absent (returns new Set, leaves input untouched)", () => {
    const original = new Set<string>(["Makan"]);
    const next = toggleExpand(original, "Transport");

    expect(next.has("Makan")).toBe(true);
    expect(next.has("Transport")).toBe(true);
    expect(next).not.toBe(original);
    expect(original.has("Transport")).toBe(false);
    expect(original.size).toBe(1);
  });

  it("removes category when present (returns new Set, leaves input untouched)", () => {
    const original = new Set<string>(["Makan", "Transport"]);
    const next = toggleExpand(original, "Makan");

    expect(next.has("Makan")).toBe(false);
    expect(next.has("Transport")).toBe(true);
    expect(next).not.toBe(original);
    expect(original.has("Makan")).toBe(true);
  });

  it("add then remove returns a Set equivalent to the original", () => {
    const original = new Set<string>(["Makan", "Transport", "Hiburan"]);
    const added = toggleExpand(original, "Belanja");
    const reverted = toggleExpand(added, "Belanja");

    // Same membership as original
    expect(reverted.size).toBe(original.size);
    for (const item of original) expect(reverted.has(item)).toBe(true);
    for (const item of reverted) expect(original.has(item)).toBe(true);

    // But still a fresh Set instance (immutable contract)
    expect(reverted).not.toBe(original);
  });

  it("remove then add returns a Set equivalent to the original (involution)", () => {
    const original = new Set<string>(["Makan", "Transport"]);
    const removed = toggleExpand(original, "Makan");
    const reAdded = toggleExpand(removed, "Makan");

    expect(reAdded.size).toBe(original.size);
    for (const item of original) expect(reAdded.has(item)).toBe(true);
  });

  it("works on empty Set", () => {
    const original = new Set<string>();
    const next = toggleExpand(original, "Makan");

    expect(next.has("Makan")).toBe(true);
    expect(original.size).toBe(0);
  });

  it("EMPTY_EXPANDED_KEYS returns a fresh empty Set on each call", () => {
    const a = EMPTY_EXPANDED_KEYS();
    const b = EMPTY_EXPANDED_KEYS();

    expect(a.size).toBe(0);
    expect(b.size).toBe(0);
    expect(a).not.toBe(b);

    a.add("Makan");
    expect(b.size).toBe(0);
  });
});
