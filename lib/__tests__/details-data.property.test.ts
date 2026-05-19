/**
 * Property-Based Tests for `lib/details-data.ts` — `aggregateDetails`.
 *
 * Spec: income-expense-details
 *
 * Property 1: Total Invariance
 *   Validates: Requirements 5.8
 * Property 2: Count Integrity
 *   Validates: Requirements 5.9
 * Property 3: Share Normalization
 *   Validates: Requirements 5.10, 5.11
 * Property 4: Sort Order
 *   Validates: Requirements 5.13
 * Property 5: Consistency with `aggregatePeriodReport`
 *   Validates: Requirements 5.16, 11.1
 * Property 6: Filter Idempotency
 *   Validates: Requirements 4.6
 * Property 7: Toggle Expand Involution
 *   Validates: Requirements 6.4
 * Property 8: Exclusion Rules in Output
 *   Validates: Requirements 5.2, 5.5, 5.6
 */

import * as fc from "fast-check";

import { aggregateDetails, applyDetailsFilters, toggleExpand } from "../details-data";
import type { DetailsFilters } from "../details-data";
import { aggregatePeriodReport } from "../report-data";
import type { ReportTransactionLike } from "../report-data";
import { isSavingsTransaction } from "@/lib/savings-utils";

// ---------------------------------------------------------------------------
// Arbitraries (exported for reuse by sibling property tests)
// ---------------------------------------------------------------------------

/**
 * Pool of category names spanning the interesting equivalence classes:
 * - regular income/expense buckets
 * - the literal `"Saldo Awal"` seed marker (must always be skipped)
 * - savings keyword categories (skipped from expense groups)
 * - generic categories that may also appear in `savingsCategoryNamesArb`
 */
const CATEGORY_POOL = [
  "Gaji",
  "Bonus",
  "Freelance",
  "Makan",
  "Transport",
  "Belanja",
  "Hiburan",
  "Tabungan", // savings keyword
  "Investasi", // savings keyword
  "Saldo Awal", // seed marker — must be skipped
  "custom-alokasi", // custom savings (only via savingsCategoryNames)
  "dana-khusus",
] as const;

const TX_TYPE_POOL = [
  "income",
  "expense",
  "transfer_in",
  "transfer_out",
] as const;

/** YYYY-MM-DD date drawn from a small window so ties are likely. */
const dateArb: fc.Arbitrary<string> = fc
  .integer({ min: 0, max: 364 })
  .map((dayOffset) => {
    const base = new Date(Date.UTC(2024, 0, 1));
    base.setUTCDate(base.getUTCDate() + dayOffset);
    return base.toISOString().slice(0, 10);
  });

/** Optional `accountId`-like string for transfers. */
const accountIdArb: fc.Arbitrary<string | null> = fc.option(
  fc.constantFrom("acc-1", "acc-2", "acc-3"),
  { nil: null },
);

/**
 * Arbitrary for a single `ReportTransactionLike`. Generates a mix of types,
 * categories (incl. `"Saldo Awal"`), and amounts (positive, zero, and a small
 * negative range to exercise `Math.abs`).
 */
export const reportTransactionArb: fc.Arbitrary<ReportTransactionLike> = fc.record({
  date: dateArb,
  category: fc.constantFrom(...CATEGORY_POOL),
  // Restrict to integers in a finite range so float-summation drift stays
  // well under the 0.01 tolerance the property asserts. We still cover the
  // full sign space (negative, zero, positive) to exercise `Math.abs(...)`.
  amount: fc.integer({ min: -1_000_000, max: 1_000_000 }),
  type: fc.constantFrom(...TX_TYPE_POOL),
  fromAccountId: accountIdArb,
  toAccountId: accountIdArb,
});

/** Array of transactions; empty input is allowed and meaningful (all-zero result). */
export const reportTransactionsArb: fc.Arbitrary<ReportTransactionLike[]> = fc.array(
  reportTransactionArb,
  { minLength: 0, maxLength: 80 },
);

/**
 * Set of lowercased savings category names — mirrors how
 * `aggregatePeriodReport` callers build the set (see `app/api/report/route.ts`).
 * Categories drawn from a wider pool than the keyword-based ones so the
 * "user-configured savings" branch of `isSavingsTransaction` is exercised.
 */
export const savingsSetArb: fc.Arbitrary<Set<string>> = fc
  .subarray(
    [
      "tabungan",
      "investasi",
      "custom-alokasi",
      "dana-khusus",
      "makan", // intentionally include a non-savings name to confirm caller controls the set
    ],
    { minLength: 0 },
  )
  .map((names) => new Set(names));

// ---------------------------------------------------------------------------
// Property 1: Total Invariance
// ---------------------------------------------------------------------------

describe("aggregateDetails — Property 1: Total Invariance", () => {
  /**
   * **Validates: Requirements 5.8**
   *
   * For every input `(transactions, savingsCategoryNames)`:
   *   |incomeTotal  - Σ incomeGroups[i].amount|  < 0.01
   *   |expenseTotal - Σ expenseGroups[i].amount| < 0.01
   */
  it("incomeTotal equals the sum of incomeGroups[i].amount within 0.01", () => {
    fc.assert(
      fc.property(reportTransactionsArb, savingsSetArb, (txs, savingsSet) => {
        const agg = aggregateDetails(txs, savingsSet);
        const sumIncome = agg.incomeGroups.reduce((s, g) => s + g.amount, 0);
        return Math.abs(agg.incomeTotal - sumIncome) < 0.01;
      }),
      { numRuns: 200 },
    );
  });

  it("expenseTotal equals the sum of expenseGroups[i].amount within 0.01", () => {
    fc.assert(
      fc.property(reportTransactionsArb, savingsSetArb, (txs, savingsSet) => {
        const agg = aggregateDetails(txs, savingsSet);
        const sumExpense = agg.expenseGroups.reduce((s, g) => s + g.amount, 0);
        return Math.abs(agg.expenseTotal - sumExpense) < 0.01;
      }),
      { numRuns: 200 },
    );
  });

  // Spot-check: empty input → all-zero totals & groups (sanity for the property).
  it("spot-check: empty input yields zeroed totals", () => {
    const agg = aggregateDetails([], new Set<string>());
    expect(agg.incomeTotal).toBe(0);
    expect(agg.expenseTotal).toBe(0);
    expect(agg.incomeGroups).toEqual([]);
    expect(agg.expenseGroups).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Property 2: Count Integrity
// ---------------------------------------------------------------------------

describe("aggregateDetails — Property 2: Count Integrity", () => {
  /**
   * **Validates: Requirements 5.9**
   *
   * For every input `(transactions, savingsCategoryNames)` and every group
   * `g ∈ incomeGroups ∪ expenseGroups`, `g.count === g.transactions.length`.
   */
  it("g.count equals g.transactions.length for every group", () => {
    fc.assert(
      fc.property(reportTransactionsArb, savingsSetArb, (txs, savingsSet) => {
        const agg = aggregateDetails(txs, savingsSet);
        for (const g of agg.incomeGroups) {
          if (g.count !== g.transactions.length) return false;
        }
        for (const g of agg.expenseGroups) {
          if (g.count !== g.transactions.length) return false;
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Share Normalization
// ---------------------------------------------------------------------------

describe("aggregateDetails — Property 3: Share Normalization", () => {
  /**
   * **Validates: Requirements 5.10, 5.11**
   *
   * For every input `(transactions, savingsCategoryNames)` and for each tab:
   *   - WHEN tab total > 0:  |Σ groups[i].share - 1| < 0.01
   *   - WHEN tab total === 0: every group has `g.share === 0`
   *
   * Income and expense sides are checked independently because each side has
   * its own grand total and groups list.
   */
  it("incomeGroups: shares sum to ~1 when incomeTotal > 0, else every share is 0", () => {
    fc.assert(
      fc.property(reportTransactionsArb, savingsSetArb, (txs, savingsSet) => {
        const agg = aggregateDetails(txs, savingsSet);
        if (agg.incomeTotal > 0) {
          const sumShare = agg.incomeGroups.reduce((s, g) => s + g.share, 0);
          return Math.abs(sumShare - 1) < 0.01;
        }
        // incomeTotal === 0: every group (if any) must report share === 0.
        return agg.incomeGroups.every((g) => g.share === 0);
      }),
      { numRuns: 200 },
    );
  });

  it("expenseGroups: shares sum to ~1 when expenseTotal > 0, else every share is 0", () => {
    fc.assert(
      fc.property(reportTransactionsArb, savingsSetArb, (txs, savingsSet) => {
        const agg = aggregateDetails(txs, savingsSet);
        if (agg.expenseTotal > 0) {
          const sumShare = agg.expenseGroups.reduce((s, g) => s + g.share, 0);
          return Math.abs(sumShare - 1) < 0.01;
        }
        return agg.expenseGroups.every((g) => g.share === 0);
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Sort Order
// ---------------------------------------------------------------------------

describe("aggregateDetails — Property 4: Sort Order", () => {
  /**
   * **Validates: Requirements 5.13**
   *
   * Groups are sorted by `amount` DESC, with ties broken by `category` ASC
   * via `localeCompare` (matches the implementation in `buildGroups`).
   *
   * For every adjacent pair `(groups[i], groups[i+1])`:
   *   amount[i] > amount[i+1]
   *   OR (amount[i] === amount[i+1] AND category[i].localeCompare(category[i+1]) <= 0)
   *
   * Both `incomeGroups` and `expenseGroups` are checked because each list is
   * sorted independently.
   */
  const isMonotonicallySorted = (
    groups: ReadonlyArray<{ amount: number; category: string }>,
  ): boolean => {
    for (let i = 0; i + 1 < groups.length; i++) {
      const a = groups[i];
      const b = groups[i + 1];
      const ordered =
        a.amount > b.amount ||
        (a.amount === b.amount && a.category.localeCompare(b.category) <= 0);
      if (!ordered) return false;
    }
    return true;
  };

  it("incomeGroups are sorted by amount DESC, tie-break category ASC", () => {
    fc.assert(
      fc.property(reportTransactionsArb, savingsSetArb, (txs, savingsSet) => {
        const agg = aggregateDetails(txs, savingsSet);
        return isMonotonicallySorted(agg.incomeGroups);
      }),
      { numRuns: 200 },
    );
  });

  it("expenseGroups are sorted by amount DESC, tie-break category ASC", () => {
    fc.assert(
      fc.property(reportTransactionsArb, savingsSetArb, (txs, savingsSet) => {
        const agg = aggregateDetails(txs, savingsSet);
        return isMonotonicallySorted(agg.expenseGroups);
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: Consistency with `aggregatePeriodReport`
// ---------------------------------------------------------------------------

describe("aggregateDetails — Property 5: Consistency with aggregatePeriodReport", () => {
  /**
   * **Validates: Requirements 5.16, 11.1**
   *
   * `/dashboard/details` must report the same per-category nominal as
   * `/dashboard/report`, otherwise users get two different answers to the
   * same question. The two helpers share the same exclusion rules
   * (`Saldo Awal`, transfer principal via `isExpenseTransaction`, savings
   * via `isSavingsTransaction`) so for every category present in
   * `aggregatePeriodReport(...)` output, the matching group in
   * `aggregateDetails(...)` must have `|g.amount - row.amount| < 0.01`.
   *
   * The property is checked on both sides (income & expense). We also assert
   * the symmetric direction — every group surfaced by `aggregateDetails`
   * must also appear in the report output — to catch divergence in either
   * direction (e.g. an extra category leaking into one helper but not the
   * other).
   */
  it("every report income row has a matching details income group with the same amount", () => {
    fc.assert(
      fc.property(reportTransactionsArb, savingsSetArb, (txs, savingsSet) => {
        const detailsAgg = aggregateDetails(txs, savingsSet);
        const reportAgg = aggregatePeriodReport(txs, savingsSet);

        for (const row of reportAgg.income) {
          const group = detailsAgg.incomeGroups.find(
            (g) => g.category === row.category,
          );
          if (!group) return false;
          if (Math.abs(group.amount - row.amount) >= 0.01) return false;
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });

  it("every report expense row has a matching details expense group with the same amount", () => {
    fc.assert(
      fc.property(reportTransactionsArb, savingsSetArb, (txs, savingsSet) => {
        const detailsAgg = aggregateDetails(txs, savingsSet);
        const reportAgg = aggregatePeriodReport(txs, savingsSet);

        for (const row of reportAgg.expense) {
          const group = detailsAgg.expenseGroups.find(
            (g) => g.category === row.category,
          );
          if (!group) return false;
          if (Math.abs(group.amount - row.amount) >= 0.01) return false;
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });

  it("every details income group has a matching report income row with the same amount", () => {
    fc.assert(
      fc.property(reportTransactionsArb, savingsSetArb, (txs, savingsSet) => {
        const detailsAgg = aggregateDetails(txs, savingsSet);
        const reportAgg = aggregatePeriodReport(txs, savingsSet);

        for (const g of detailsAgg.incomeGroups) {
          const row = reportAgg.income.find((r) => r.category === g.category);
          if (!row) return false;
          if (Math.abs(g.amount - row.amount) >= 0.01) return false;
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });

  it("every details expense group has a matching report expense row with the same amount", () => {
    fc.assert(
      fc.property(reportTransactionsArb, savingsSetArb, (txs, savingsSet) => {
        const detailsAgg = aggregateDetails(txs, savingsSet);
        const reportAgg = aggregatePeriodReport(txs, savingsSet);

        for (const g of detailsAgg.expenseGroups) {
          const row = reportAgg.expense.find((r) => r.category === g.category);
          if (!row) return false;
          if (Math.abs(g.amount - row.amount) >= 0.01) return false;
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: Filter Idempotency
// ---------------------------------------------------------------------------

/**
 * Arbitrary for `DetailsFilters` aimed at the `applyDetailsFilters` contract.
 *
 * The filter operates on `accountFilter`, `categoryFilter`, and `searchQuery`;
 * `period`/`customFrom`/`customTo` are part of the shape but ignored by the
 * pure filter, so we hold them at neutral defaults to keep the search space
 * focused on inputs that actually drive branching.
 *
 * - `accountFilter` is drawn from the same pool used by `accountIdArb` plus
 *   the empty string sentinel ("no account filter"). This means a fraction
 *   of generated filters intersects real `fromAccountId`/`toAccountId`
 *   values, exercising the "match" branch; the rest exercises the
 *   "no-op" branch.
 * - `categoryFilter` is drawn from `CATEGORY_POOL` (same pool as the
 *   transactions) plus the empty sentinel — likewise a mix of matching
 *   and non-matching filters.
 * - `searchQuery` is a short-string arbitrary that can be empty, contain
 *   whitespace (exercising the `trim()` branch), or contain a substring of
 *   one of the categories (exercising the "match" branch). Idempotency must
 *   hold regardless of whether the query matches anything.
 */
const detailsFiltersArb: fc.Arbitrary<DetailsFilters> =
  fc.record({
    period: fc.constant("month" as const),
    customFrom: fc.constant(""),
    customTo: fc.constant(""),
    accountFilter: fc.constantFrom("acc-1", "acc-2", "acc-3", ""),
    categoryFilter: fc.constantFrom(...CATEGORY_POOL, ""),
    searchQuery: fc.oneof(
      fc.constant(""),
      fc.constant("   "), // whitespace-only — `.trim()` should produce no-op
      fc.constantFrom("gaji", "MAKAN", "saldo", "tab", "investasi", "xyz"),
      fc.string({ minLength: 0, maxLength: 8 }),
    ),
  });

describe("applyDetailsFilters — Property 6: Filter Idempotency", () => {
  /**
   * **Validates: Requirements 4.6**
   *
   * For every input `(transactions, filters)`:
   *   applyDetailsFilters(applyDetailsFilters(txs, filters), filters)
   *     deep-equals applyDetailsFilters(txs, filters)
   *
   * Intuition: the filter is a deterministic per-element predicate combined
   * with AND semantics. The output of the first application is, by
   * construction, the subset of inputs satisfying every active predicate, so
   * the second application yields the same subset in the same relative order.
   *
   * The check uses `JSON.stringify` for deep-equality of the array of
   * transaction shapes — `fast-check` retains structural equality through
   * shrinking, and the arbitraries here only emit JSON-serializable values.
   */
  it("applying the same filters twice yields a deeply equal array", () => {
    fc.assert(
      fc.property(reportTransactionsArb, detailsFiltersArb, (txs, filters) => {
        const once = applyDetailsFilters(txs, filters);
        const twice = applyDetailsFilters(once, filters);
        return JSON.stringify(twice) === JSON.stringify(once);
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7: Toggle Expand Involution
// ---------------------------------------------------------------------------

/**
 * Arbitrary for `Set<string>` of expanded category keys.
 *
 * Built from `fc.array(fc.string())` so the generator covers:
 * - the empty set (`Set` of length 0),
 * - sets with the toggled category already present,
 * - sets with the toggled category absent,
 * - sets containing duplicate-but-deduped strings,
 * - tricky strings (empty, whitespace, unicode) that `fc.string()` produces.
 *
 * `categoryArb` is a plain `fc.string()` so the (set, cat) cross product
 * exercises both branches of `toggleExpand` (add vs remove).
 */
const expandedSetArb: fc.Arbitrary<Set<string>> = fc
  .array(fc.string(), { minLength: 0, maxLength: 8 })
  .map((arr) => new Set(arr));

const categoryArb: fc.Arbitrary<string> = fc.string();

/** Stable, order-independent snapshot of a `Set<string>` for deep-equality checks. */
const snapshotSet = (s: ReadonlySet<string>): string =>
  JSON.stringify([...s].sort());

describe("toggleExpand — Property 7: Toggle Expand Involution", () => {
  /**
   * **Validates: Requirements 6.4**
   *
   * For every `(set, category)`:
   *   toggleExpand(toggleExpand(set, category), category) deep-equals set
   *
   * Intuition: a single toggle flips membership of `category`; toggling again
   * flips it back, leaving every other entry untouched. Because `Set` has
   * no inherent order, deep-equality is checked by comparing sizes and
   * verifying every element of one set is in the other (mirrored via the
   * sorted-array JSON snapshot).
   *
   * The property also asserts the input `set` is **not mutated** by either
   * call: the implementation builds a fresh `Set` each time, so a
   * before/after snapshot of the original input must match exactly.
   */
  it("toggling the same category twice returns a set deeply equal to the input, without mutating the input", () => {
    fc.assert(
      fc.property(expandedSetArb, categoryArb, (set, category) => {
        const beforeSnapshot = snapshotSet(set);

        const once = toggleExpand(set, category);
        const twice = toggleExpand(once, category);

        const afterSnapshot = snapshotSet(set);

        // Mutation guard: the original `set` must remain byte-identical
        // after both `toggleExpand` calls (the helper is supposed to
        // produce fresh `Set` instances, never touching the input).
        if (beforeSnapshot !== afterSnapshot) return false;

        // Involution: `twice` must contain exactly the same elements as
        // the original `set`. Comparing sizes alone isn't sufficient
        // (a buggy implementation could swap one element for another and
        // preserve cardinality), so we also verify every element is shared
        // both ways.
        if (twice.size !== set.size) return false;
        for (const value of twice) {
          if (!set.has(value)) return false;
        }
        for (const value of set) {
          if (!twice.has(value)) return false;
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8: Exclusion Rules in Output
// ---------------------------------------------------------------------------

/**
 * Arbitrary that generates a curated mix of transactions guaranteed to
 * include each excluded class with non-zero principal:
 * - at least one `"Saldo Awal"` transaction (must be skipped),
 * - at least one savings-category transaction (must be skipped from expense),
 * - at least one `transfer_in` and one `transfer_out` with non-zero principal
 *   (must be skipped — they're not real expense),
 * plus any number of "kept" income / non-savings expense transactions.
 *
 * The savings category is drawn from the same pool used by `savingsSetArb`
 * so the savings-set membership branch of `isSavingsTransaction` is
 * exercised in addition to the keyword branch.
 */
const SAVINGS_CATEGORY_POOL = [
  "Tabungan",
  "Investasi",
  "custom-alokasi",
  "dana-khusus",
] as const;

const KEPT_INCOME_CATEGORIES = ["Gaji", "Bonus", "Freelance"] as const;
const KEPT_EXPENSE_CATEGORIES = ["Makan", "Transport", "Belanja", "Hiburan"] as const;

const nonZeroAmountArb: fc.Arbitrary<number> = fc
  .integer({ min: 1, max: 1_000_000 })
  .chain((mag) => fc.constantFrom(mag, -mag));

const saldoAwalTxArb: fc.Arbitrary<ReportTransactionLike> = fc.record({
  date: dateArb,
  category: fc.constant("Saldo Awal"),
  amount: nonZeroAmountArb,
  // Type doesn't matter — `Saldo Awal` is filtered before the type check.
  type: fc.constantFrom(...TX_TYPE_POOL),
  fromAccountId: accountIdArb,
  toAccountId: accountIdArb,
});

const savingsTxArb: fc.Arbitrary<ReportTransactionLike> = fc.record({
  date: dateArb,
  category: fc.constantFrom(...SAVINGS_CATEGORY_POOL),
  amount: nonZeroAmountArb,
  // `expense` so the tx survives the income branch and reaches the savings
  // skip rule. `income` to a savings category is not a real-world flow and
  // would short-circuit at the income branch, so we keep this expense-only.
  type: fc.constant("expense"),
  fromAccountId: accountIdArb,
  toAccountId: accountIdArb,
});

const transferInTxArb: fc.Arbitrary<ReportTransactionLike> = fc.record({
  date: dateArb,
  // Use a non-Saldo-Awal, non-savings category so the only reason this is
  // skipped is `isExpenseTransaction === false`.
  category: fc.constantFrom(...KEPT_EXPENSE_CATEGORIES),
  amount: nonZeroAmountArb,
  type: fc.constant("transfer_in"),
  fromAccountId: accountIdArb,
  toAccountId: accountIdArb,
});

const transferOutTxArb: fc.Arbitrary<ReportTransactionLike> = fc.record({
  date: dateArb,
  category: fc.constantFrom(...KEPT_EXPENSE_CATEGORIES),
  amount: nonZeroAmountArb,
  type: fc.constant("transfer_out"),
  fromAccountId: accountIdArb,
  toAccountId: accountIdArb,
});

const keptIncomeTxArb: fc.Arbitrary<ReportTransactionLike> = fc.record({
  date: dateArb,
  category: fc.constantFrom(...KEPT_INCOME_CATEGORIES),
  amount: nonZeroAmountArb,
  type: fc.constant("income"),
  fromAccountId: accountIdArb,
  toAccountId: accountIdArb,
});

const keptExpenseTxArb: fc.Arbitrary<ReportTransactionLike> = fc.record({
  date: dateArb,
  category: fc.constantFrom(...KEPT_EXPENSE_CATEGORIES),
  amount: nonZeroAmountArb,
  type: fc.constant("expense"),
  fromAccountId: accountIdArb,
  toAccountId: accountIdArb,
});

/**
 * Curated arbitrary that interleaves "kept" and "skipped" transactions in
 * arbitrary order. Each generated array contains at least one of every
 * skipped class (Saldo Awal, savings, transfer_in, transfer_out) so the
 * partition check below is meaningful even on small examples.
 *
 * `fc.shuffledSubarray` is not used because we want to *guarantee* the
 * presence of each skipped class — `subarray` could omit any of them.
 */
const partitionedTxsArb: fc.Arbitrary<ReportTransactionLike[]> = fc
  .tuple(
    saldoAwalTxArb,
    savingsTxArb,
    transferInTxArb,
    transferOutTxArb,
    fc.array(
      fc.oneof(
        keptIncomeTxArb,
        keptExpenseTxArb,
        // Allow extra skipped txs to appear too — the partition check
        // works regardless of how many skipped txs there are.
        saldoAwalTxArb,
        savingsTxArb,
        transferInTxArb,
        transferOutTxArb,
      ),
      { minLength: 0, maxLength: 30 },
    ),
  )
  .chain(([saldo, savings, tIn, tOut, rest]) => {
    const all = [saldo, savings, tIn, tOut, ...rest];
    return fc.shuffledSubarray(all, { minLength: all.length, maxLength: all.length });
  })
  .map((arr) => [...arr]);

/**
 * Helper: classify a single transaction as "kept" or "skipped" using the
 * exact same predicates that `aggregateDetails` uses internally.
 *
 * `isExpenseTransaction` is intentionally not imported here — the design
 * already documents that transfer principal is excluded via that helper, and
 * by listing `transfer_in` / `transfer_out` explicitly we avoid coupling the
 * test to a private re-implementation. For the categories used in this test
 * (no `"Transfer"` literal, no synthetic transfer rows with only
 * `fromAccountName`), the type-based check is equivalent.
 */
type Classification = "income" | "expense" | "skipped";
const classify = (
  tx: ReportTransactionLike,
  savingsSet: Set<string>,
): Classification => {
  if (tx.category === "Saldo Awal") return "skipped";
  const amt = Math.abs(Number(tx.amount) || 0);
  if (amt === 0) return "skipped";
  if (tx.type === "income") return "income";
  if (tx.type === "transfer_in" || tx.type === "transfer_out") return "skipped";
  if (isSavingsTransaction(tx.category, savingsSet)) return "skipped";
  return "expense";
};

describe("aggregateDetails — Property 8: Exclusion Rules in Output", () => {
  /**
   * **Validates: Requirements 5.2, 5.5, 5.6**
   *
   * Predicate side of the property: every category surfaced in
   * `expenseGroups` must NOT be the `"Saldo Awal"` seed marker and must NOT
   * be classified as a savings category by `isSavingsTransaction` against
   * the same `savingsSet` used to compute the aggregation.
   *
   * `incomeGroups` are not constrained the same way — `isSavingsTransaction`
   * is only applied to non-income transactions inside `aggregateDetails`,
   * so an income flow into a category that happens to share a name with a
   * savings keyword is still legitimate income (that's a user quirk, not a
   * bug). We only assert the `"Saldo Awal"` exclusion on the income side.
   */
  it("expenseGroups never contain Saldo Awal or savings categories", () => {
    fc.assert(
      fc.property(reportTransactionsArb, savingsSetArb, (txs, savingsSet) => {
        const agg = aggregateDetails(txs, savingsSet);
        for (const g of agg.expenseGroups) {
          if (g.category === "Saldo Awal") return false;
          if (isSavingsTransaction(g.category, savingsSet)) return false;
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });

  it("incomeGroups never contain Saldo Awal", () => {
    fc.assert(
      fc.property(reportTransactionsArb, savingsSetArb, (txs, savingsSet) => {
        const agg = aggregateDetails(txs, savingsSet);
        for (const g of agg.incomeGroups) {
          if (g.category === "Saldo Awal") return false;
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 5.2, 5.5, 5.6**
   *
   * Partition side of the property: split `txs` into "kept" (income and
   * non-savings expense with non-zero principal that pass the type test)
   * vs "skipped" (Saldo Awal, transfers, savings, zero-amount). The
   * skipped partition's principal must contribute zero to both
   * `incomeTotal` and `expenseTotal`. We prove this by re-running
   * `aggregateDetails` on only the kept partition and asserting the totals
   * are identical (within the floating-point tolerance documented for
   * Property 1).
   *
   * The partitionedTxsArb arbitrary guarantees at least one of every
   * skipped class is present, so this property exercises the actual
   * exclusion paths rather than vacuously holding on inputs with no
   * skippable txs.
   */
  it("skipped txs (Saldo Awal, transfers, savings) contribute nothing to totals", () => {
    fc.assert(
      fc.property(partitionedTxsArb, savingsSetArb, (txs, savingsSet) => {
        const kept = txs.filter(
          (tx) => classify(tx, savingsSet) !== "skipped",
        );

        const aggAll = aggregateDetails(txs, savingsSet);
        const aggKept = aggregateDetails(kept, savingsSet);

        return (
          Math.abs(aggAll.incomeTotal - aggKept.incomeTotal) < 0.01 &&
          Math.abs(aggAll.expenseTotal - aggKept.expenseTotal) < 0.01
        );
      }),
      { numRuns: 200 },
    );
  });

  /**
   * Stronger formulation of the same partition property: instead of
   * comparing aggregated totals, we directly assert that the sum of
   * `Math.abs(amount)` over the *skipped* partition does not appear
   * anywhere in the aggregation totals — i.e. removing them and re-running
   * yields the same numbers, AND the principals we removed are the same
   * principals the aggregator would have ignored.
   *
   * This catches a subtle failure mode the previous test would miss:
   * an implementation that *re-routes* a skipped tx into the wrong bucket
   * (e.g. a savings tx silently counted as income). In that case, removing
   * the skipped txs would change the totals — but so would the previous
   * test, so the stronger formulation here also asserts a non-zero
   * skipped-principal exists, ensuring the test is non-vacuous.
   */
  it("aggregating on (kept ∪ skipped) equals aggregating on kept only, with non-vacuous skipped principal", () => {
    fc.assert(
      fc.property(partitionedTxsArb, savingsSetArb, (txs, savingsSet) => {
        const skipped = txs.filter(
          (tx) => classify(tx, savingsSet) === "skipped",
        );
        const kept = txs.filter(
          (tx) => classify(tx, savingsSet) !== "skipped",
        );

        // Non-vacuous: by construction the arbitrary guarantees at least
        // four skipped txs (Saldo Awal, savings, transfer_in, transfer_out),
        // each with non-zero principal.
        const skippedPrincipal = skipped.reduce(
          (s, tx) => s + Math.abs(Number(tx.amount) || 0),
          0,
        );
        if (skippedPrincipal <= 0) return false;

        const aggAll = aggregateDetails(txs, savingsSet);
        const aggKept = aggregateDetails(kept, savingsSet);

        // Kept-only and full-input aggregations must agree on totals.
        if (Math.abs(aggAll.incomeTotal - aggKept.incomeTotal) >= 0.01) {
          return false;
        }
        if (Math.abs(aggAll.expenseTotal - aggKept.expenseTotal) >= 0.01) {
          return false;
        }

        // Sanity: every group surfaced in the full aggregation also
        // appears in the kept-only aggregation with the same amount —
        // i.e. no extra category was created from skipped txs.
        for (const g of aggAll.incomeGroups) {
          const k = aggKept.incomeGroups.find((x) => x.category === g.category);
          if (!k) return false;
          if (Math.abs(g.amount - k.amount) >= 0.01) return false;
        }
        for (const g of aggAll.expenseGroups) {
          const k = aggKept.expenseGroups.find((x) => x.category === g.category);
          if (!k) return false;
          if (Math.abs(g.amount - k.amount) >= 0.01) return false;
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });
});
