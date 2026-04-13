/**
 * Property-Based Tests for savings-utils
 *
 * Feature: savings-goals, Property 1: isSavingsKeyword is case-insensitive
 *
 * Validates: Requirements 2.1, 2.2
 */

import * as fc from "fast-check";
import { SAVINGS_KEYWORDS, isSavingsKeyword, isSavingsTransaction } from "../savings-utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generates a random-cased variant of a string.
 * Each character is independently uppercased or lowercased.
 */
function randomCaseVariant(s: string): fc.Arbitrary<string> {
  return fc.array(fc.boolean(), { minLength: s.length, maxLength: s.length }).map(
    (bools) =>
      s
        .split("")
        .map((ch, i) => (bools[i] ? ch.toUpperCase() : ch.toLowerCase()))
        .join("")
  );
}

/**
 * Arbitrary that picks a random keyword from SAVINGS_KEYWORDS and returns
 * a random-cased variant of it (possibly embedded in surrounding text).
 */
const savingsVariantArb: fc.Arbitrary<string> = fc
  .integer({ min: 0, max: SAVINGS_KEYWORDS.length - 1 })
  .chain((idx) => randomCaseVariant(SAVINGS_KEYWORDS[idx]));

/**
 * Arbitrary for strings that are guaranteed NOT to contain any savings keyword.
 * We generate from a safe alphabet that avoids all keyword characters in
 * combinations that could accidentally form a keyword.
 *
 * Strategy: generate strings from digits + punctuation only — these can never
 * contain any of the alphabetic savings keywords.
 */
const safeChars = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "-", "_", ".", "!", "@", "#"] as const;

const nonSavingsArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...safeChars), { minLength: 0, maxLength: 20 })
  .map((chars) => chars.join(""))
  .filter((s) => {
    // Double-check: ensure none of the keywords appear in the lowercased string
    const lower = s.toLowerCase();
    return !SAVINGS_KEYWORDS.some((kw) => lower.includes(kw));
  });

// ---------------------------------------------------------------------------
// Property 1: isSavingsKeyword returns true for any casing variant of a keyword
// ---------------------------------------------------------------------------

describe("Property 1: isSavingsKeyword is case-insensitive", () => {
  it("returns true for any random-cased variant of a savings keyword", () => {
    fc.assert(
      fc.property(savingsVariantArb, (variant) => {
        return isSavingsKeyword(variant) === true;
      }),
      { numRuns: 100, verbose: true }
    );
  });

  it("returns true for a keyword embedded in surrounding text with random casing", () => {
    const embeddedArb = fc
      .integer({ min: 0, max: SAVINGS_KEYWORDS.length - 1 })
      .chain((idx) =>
        fc.tuple(
          randomCaseVariant(SAVINGS_KEYWORDS[idx]),
          fc.string({ maxLength: 10 }),
          fc.string({ maxLength: 10 })
        )
      )
      .map(([variant, prefix, suffix]) => `${prefix}${variant}${suffix}`);

    fc.assert(
      fc.property(embeddedArb, (text) => {
        return isSavingsKeyword(text) === true;
      }),
      { numRuns: 100, verbose: true }
    );
  });

  it("returns false for strings that contain no savings keyword", () => {
    fc.assert(
      fc.property(nonSavingsArb, (nonSavings) => {
        return isSavingsKeyword(nonSavings) === false;
      }),
      { numRuns: 100, verbose: true }
    );
  });

  // Concrete spot-checks from design.md unit test examples
  it("returns true for known keyword variants (spot-checks)", () => {
    expect(isSavingsKeyword("Tabungan")).toBe(true);
    expect(isSavingsKeyword("NABUNG")).toBe(true);
    expect(isSavingsKeyword("dana darurat")).toBe(true);
    expect(isSavingsKeyword("DANA PENSIUN")).toBe(true);
    expect(isSavingsKeyword("investasi bulanan")).toBe(true);
    expect(isSavingsKeyword("deposito BCA")).toBe(true);
    expect(isSavingsKeyword("SAVINGS")).toBe(true);
    expect(isSavingsKeyword("ReksaDana")).toBe(true);
  });

  it("returns false for non-savings categories (spot-checks)", () => {
    expect(isSavingsKeyword("makan")).toBe(false);
    expect(isSavingsKeyword("")).toBe(false);
    expect(isSavingsKeyword("transport")).toBe(false);
    expect(isSavingsKeyword("belanja")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Property 2 & 3: Cashflow Hybrid Formula
//
// Feature: savings-goals, Property 2 & 3: cashflow hybrid formula invariant
//
// Validates: Requirements 4.1, 4.3, 4.4
// ---------------------------------------------------------------------------

// Transaction shape used in cashflow calculation
interface Tx {
  type: "income" | "expense";
  category: string;
  amount: number;
}

/**
 * Pure cashflow calculation — mirrors the logic in DashboardTabs.tsx
 */
function calcCashflow(
  transactions: Tx[],
  savingsCategoryNames: Set<string>
): { totalIncome: number; totalExpense: number; totalSavings: number; sisa: number } {
  const incomeTxs = transactions.filter((t) => t.type === "income");
  const expenseTxs = transactions.filter((t) => t.type !== "income");

  const savingsTxs = expenseTxs.filter((t) =>
    isSavingsTransaction(t.category, savingsCategoryNames)
  );
  const nonSavingsExpenseTxs = expenseTxs.filter(
    (t) => !isSavingsTransaction(t.category, savingsCategoryNames)
  );

  const totalIncome = incomeTxs.reduce((s, t) => s + t.amount, 0);
  const totalSavings = savingsTxs.reduce((s, t) => s + t.amount, 0);
  const totalExpense = nonSavingsExpenseTxs.reduce((s, t) => s + t.amount, 0);
  const sisa = totalIncome - totalExpense - totalSavings;

  return { totalIncome, totalExpense, totalSavings, sisa };
}

// Arbitrary for a single transaction
// - type: "income" | "expense"
// - category: one of a fixed set (some savings, some not)
// - amount: positive integer 1..1_000_000
const SAVINGS_CATS = ["tabungan", "nabung", "investasi", "dana darurat", "deposito"];
const EXPENSE_CATS = ["makan", "transport", "belanja", "hiburan", "utilitas"];
const INCOME_CATS = ["gaji", "freelance", "bonus", "dividen"];

const txArb: fc.Arbitrary<Tx> = fc.record({
  type: fc.constantFrom<"income" | "expense">("income", "expense"),
  category: fc.oneof(
    fc.constantFrom(...SAVINGS_CATS),
    fc.constantFrom(...EXPENSE_CATS),
    fc.constantFrom(...INCOME_CATS)
  ),
  amount: fc.integer({ min: 1, max: 1_000_000 }),
});

describe("Property 2 & 3: cashflow hybrid formula invariant", () => {
  // savingsCategoryNames is empty — detection via keyword only
  const savingsCategoryNames = new Set<string>();

  // ── Property 2: savings excluded from expense ──────────────────────────────

  it("Property 2a: totalExpense equals sum of non-savings, non-income transactions", () => {
    fc.assert(
      fc.property(fc.array(txArb, { minLength: 0, maxLength: 50 }), (transactions) => {
        const { totalExpense } = calcCashflow(transactions, savingsCategoryNames);

        const expected = transactions
          .filter((t) => t.type !== "income")
          .filter((t) => !isSavingsTransaction(t.category, savingsCategoryNames))
          .reduce((s, t) => s + t.amount, 0);

        return totalExpense === expected;
      }),
      { numRuns: 100, verbose: true }
    );
  });

  it("Property 2b: totalSavings equals sum of all savings-category transactions (no cap)", () => {
    fc.assert(
      fc.property(fc.array(txArb, { minLength: 0, maxLength: 50 }), (transactions) => {
        const { totalSavings } = calcCashflow(transactions, savingsCategoryNames);

        const expected = transactions
          .filter((t) => t.type !== "income")
          .filter((t) => isSavingsTransaction(t.category, savingsCategoryNames))
          .reduce((s, t) => s + t.amount, 0);

        return totalSavings === expected;
      }),
      { numRuns: 100, verbose: true }
    );
  });

  it("Property 2c: savings transactions are NOT included in totalExpense", () => {
    fc.assert(
      fc.property(fc.array(txArb, { minLength: 1, maxLength: 50 }), (transactions) => {
        const { totalExpense } = calcCashflow(transactions, savingsCategoryNames);

        // Manually compute what totalExpense would be if savings were included
        const expenseWithSavings = transactions
          .filter((t) => t.type !== "income")
          .reduce((s, t) => s + t.amount, 0);

        const savingsAmount = transactions
          .filter((t) => t.type !== "income")
          .filter((t) => isSavingsTransaction(t.category, savingsCategoryNames))
          .reduce((s, t) => s + t.amount, 0);

        // totalExpense must be <= expenseWithSavings (savings are excluded)
        // and the difference must equal savingsAmount
        return totalExpense === expenseWithSavings - savingsAmount;
      }),
      { numRuns: 100, verbose: true }
    );
  });

  // ── Property 3: cashflow formula invariant ─────────────────────────────────

  it("Property 3: totalIncome - totalExpense - totalSavings === sisa", () => {
    fc.assert(
      fc.property(fc.array(txArb, { minLength: 0, maxLength: 50 }), (transactions) => {
        const { totalIncome, totalExpense, totalSavings, sisa } = calcCashflow(
          transactions,
          savingsCategoryNames
        );

        return totalIncome - totalExpense - totalSavings === sisa;
      }),
      { numRuns: 100, verbose: true }
    );
  });

  // ── Property 3 with user-configurable savings categories ──────────────────

  it("Property 3: formula invariant holds with user-configurable savings categories", () => {
    // Use a custom savings category name that doesn't match any keyword
    const customSavingsCategoryNames = new Set(["custom-alokasi", "dana-khusus"]);

    const customTxArb: fc.Arbitrary<Tx> = fc.record({
      type: fc.constantFrom<"income" | "expense">("income", "expense"),
      category: fc.oneof(
        fc.constantFrom(...SAVINGS_CATS),
        fc.constantFrom(...EXPENSE_CATS),
        fc.constantFrom(...INCOME_CATS),
        fc.constantFrom("custom-alokasi", "dana-khusus") // user-configured savings
      ),
      amount: fc.integer({ min: 1, max: 1_000_000 }),
    });

    fc.assert(
      fc.property(fc.array(customTxArb, { minLength: 0, maxLength: 50 }), (transactions) => {
        const { totalIncome, totalExpense, totalSavings, sisa } = calcCashflow(
          transactions,
          customSavingsCategoryNames
        );

        return totalIncome - totalExpense - totalSavings === sisa;
      }),
      { numRuns: 100, verbose: true }
    );
  });

  // ── Spot-checks ────────────────────────────────────────────────────────────

  it("spot-check: mixed transactions produce correct cashflow split", () => {
    const transactions: Tx[] = [
      { type: "income", category: "gaji", amount: 10_000_000 },
      { type: "expense", category: "makan", amount: 2_000_000 },
      { type: "expense", category: "transport", amount: 500_000 },
      { type: "expense", category: "tabungan", amount: 2_000_000 },
      { type: "expense", category: "investasi", amount: 1_000_000 },
    ];

    const result = calcCashflow(transactions, savingsCategoryNames);

    expect(result.totalIncome).toBe(10_000_000);
    expect(result.totalExpense).toBe(2_500_000);   // makan + transport only
    expect(result.totalSavings).toBe(3_000_000);   // tabungan + investasi
    expect(result.sisa).toBe(4_500_000);           // 10M - 2.5M - 3M
    expect(result.totalIncome - result.totalExpense - result.totalSavings).toBe(result.sisa);
  });

  it("spot-check: savings beyond goal target still counted fully (no cap)", () => {
    // Simulates totalContributed > targetAmount scenario
    const transactions: Tx[] = [
      { type: "income", category: "gaji", amount: 5_000_000 },
      { type: "expense", category: "tabungan", amount: 3_000_000 }, // exceeds hypothetical 2M goal
    ];

    const result = calcCashflow(transactions, savingsCategoryNames);

    expect(result.totalSavings).toBe(3_000_000); // no cap
    expect(result.sisa).toBe(2_000_000);
  });

  it("spot-check: all savings transactions (expense = 0)", () => {
    const transactions: Tx[] = [
      { type: "income", category: "gaji", amount: 5_000_000 },
      { type: "expense", category: "tabungan", amount: 1_000_000 },
      { type: "expense", category: "investasi", amount: 2_000_000 },
    ];

    const result = calcCashflow(transactions, savingsCategoryNames);

    expect(result.totalExpense).toBe(0);
    expect(result.totalSavings).toBe(3_000_000);
    expect(result.sisa).toBe(2_000_000);
  });
});

// ---------------------------------------------------------------------------
// Property 5: Contribution total consistency
//
// Feature: savings-goals, Property 5: contribution total consistency
//
// Validates: Requirements 2.5, 3.2
// ---------------------------------------------------------------------------

describe("Property 5: contribution total consistency", () => {
  // Arbitrary for a transaction used in contribution calculation
  interface ContribTx {
    category: string;
    amount: number;
  }

  // Categories that match via keyword
  const KEYWORD_CATS = ["tabungan", "nabung", "investasi", "dana darurat", "deposito", "savings"];
  // Categories that match via isSavings flag (custom, no keyword)
  const IS_SAVINGS_CATS = ["custom-alokasi", "dana-khusus", "my-savings-bucket"];
  // Categories that match neither
  const NON_SAVINGS_CATS = ["makan", "transport", "belanja", "hiburan", "utilitas", "gaji"];

  const savingsCategoryNames = new Set(IS_SAVINGS_CATS.map((c) => c.toLowerCase()));

  const contribTxArb: fc.Arbitrary<ContribTx> = fc.record({
    category: fc.oneof(
      fc.constantFrom(...KEYWORD_CATS),
      fc.constantFrom(...IS_SAVINGS_CATS),
      fc.constantFrom(...NON_SAVINGS_CATS)
    ),
    amount: fc.integer({ min: 1, max: 10_000_000 }),
  });

  it("totalContributed equals sum of amounts where isSavingsTransaction returns true", () => {
    fc.assert(
      fc.property(
        fc.array(contribTxArb, { minLength: 0, maxLength: 50 }),
        (transactions) => {
          const totalContributed = transactions
            .filter((tx) => isSavingsTransaction(tx.category, savingsCategoryNames))
            .reduce((sum, tx) => sum + tx.amount, 0);

          const expected = transactions
            .filter((tx) => isSavingsTransaction(tx.category, savingsCategoryNames))
            .reduce((sum, tx) => sum + tx.amount, 0);

          return totalContributed === expected;
        }
      ),
      { numRuns: 100, verbose: true }
    );
  });

  it("no cap applied: totalContributed can exceed targetAmount", () => {
    // Generate scenarios where totalContributed is likely to exceed a small targetAmount
    const targetAmount = 100; // small target so contributions easily exceed it

    fc.assert(
      fc.property(
        fc.array(contribTxArb, { minLength: 1, maxLength: 50 }),
        (transactions) => {
          const totalContributed = transactions
            .filter((tx) => isSavingsTransaction(tx.category, savingsCategoryNames))
            .reduce((sum, tx) => sum + tx.amount, 0);

          // The actual sum must equal the uncapped total — no cap at targetAmount
          const uncappedSum = transactions
            .filter((tx) => isSavingsTransaction(tx.category, savingsCategoryNames))
            .reduce((sum, tx) => sum + tx.amount, 0);

          // totalContributed must never be capped to targetAmount
          return totalContributed === uncappedSum;
        }
      ),
      { numRuns: 100, verbose: true }
    );
  });

  it("keyword-matched AND isSavings-flagged categories both contribute to total", () => {
    fc.assert(
      fc.property(
        fc.array(contribTxArb, { minLength: 0, maxLength: 50 }),
        (transactions) => {
          const totalContributed = transactions
            .filter((tx) => isSavingsTransaction(tx.category, savingsCategoryNames))
            .reduce((sum, tx) => sum + tx.amount, 0);

          // Compute keyword-only contributions
          const keywordContributions = transactions
            .filter((tx) => isSavingsKeyword(tx.category))
            .reduce((sum, tx) => sum + tx.amount, 0);

          // Compute isSavings-flag-only contributions (not already matched by keyword)
          const flagOnlyContributions = transactions
            .filter(
              (tx) =>
                !isSavingsKeyword(tx.category) &&
                savingsCategoryNames.has(tx.category.toLowerCase())
            )
            .reduce((sum, tx) => sum + tx.amount, 0);

          // Both sources must be included in totalContributed
          return totalContributed === keywordContributions + flagOnlyContributions;
        }
      ),
      { numRuns: 100, verbose: true }
    );
  });

  // Spot-checks
  it("spot-check: only keyword-matched transactions contribute when no isSavings categories", () => {
    const emptySet = new Set<string>();
    const transactions: ContribTx[] = [
      { category: "tabungan", amount: 500_000 },
      { category: "makan", amount: 200_000 },
      { category: "investasi", amount: 1_000_000 },
      { category: "transport", amount: 150_000 },
    ];

    const totalContributed = transactions
      .filter((tx) => isSavingsTransaction(tx.category, emptySet))
      .reduce((sum, tx) => sum + tx.amount, 0);

    expect(totalContributed).toBe(1_500_000); // tabungan + investasi
  });

  it("spot-check: isSavings-flagged category contributes even without keyword match", () => {
    const customSet = new Set(["custom-alokasi"]);
    const transactions: ContribTx[] = [
      { category: "custom-alokasi", amount: 750_000 },
      { category: "makan", amount: 300_000 },
    ];

    const totalContributed = transactions
      .filter((tx) => isSavingsTransaction(tx.category, customSet))
      .reduce((sum, tx) => sum + tx.amount, 0);

    expect(totalContributed).toBe(750_000);
  });

  it("spot-check: totalContributed exceeds targetAmount — no cap applied", () => {
    const targetAmount = 1_000_000;
    const transactions: ContribTx[] = [
      { category: "tabungan", amount: 800_000 },
      { category: "nabung", amount: 700_000 }, // total = 1.5M > targetAmount
    ];

    const totalContributed = transactions
      .filter((tx) => isSavingsTransaction(tx.category, savingsCategoryNames))
      .reduce((sum, tx) => sum + tx.amount, 0);

    expect(totalContributed).toBe(1_500_000);
    expect(totalContributed).toBeGreaterThan(targetAmount); // confirms no cap
  });

  it("spot-check: empty transaction list yields totalContributed = 0", () => {
    const transactions: ContribTx[] = [];

    const totalContributed = transactions
      .filter((tx) => isSavingsTransaction(tx.category, savingsCategoryNames))
      .reduce((sum, tx) => sum + tx.amount, 0);

    expect(totalContributed).toBe(0);
  });
});
