# Implementation Plan: Rincian Pemasukan & Pengeluaran (income-expense-details)

## Overview

Build the `/dashboard/details` page that surfaces per-category drill-down for income and expenses in one place, reusing the existing `/api/record` endpoint and the same exclusion rules used by `/dashboard/report`. Strategy:

1. Start with the pure logic layer (`lib/details-data.ts`) so we can pin behavior with property and unit tests before touching React.
2. Build presentational UI primitives (TypeTabs, CategoryRow, CategoryGroupList) with no data dependencies.
3. Wire everything in `DetailsClient`, then add the server shell page and the sidebar navigation entry.
4. Validate with property-based tests (each correctness property is its own task), unit tests, and an integration test of the client.

Property-based tests use `fast-check` (already a devDependency). Unit/integration tests use `jest` + `ts-jest` (already configured at `jest.config.js`). React tests, when added, use `@testing-library/react` (install on demand only if the optional integration-test sub-task is executed).

## Tasks

- [x] 1. Pure logic layer: `lib/details-data.ts`
  - [x] 1.1 Create `lib/details-data.ts` with public types and `aggregateDetails`
    - Add file `lib/details-data.ts`.
    - Export `CategoryGroup`, `DetailsAggregation`, `DetailsFilters` types matching the design.
    - Implement `aggregateDetails(transactions, savingsCategoryNames): DetailsAggregation`:
      - Skip `tx.category === "Saldo Awal"`.
      - Skip when `Math.abs(Number(tx.amount) || 0) === 0`.
      - For `tx.type === "income"`, accumulate into income bucket via `Math.abs(tx.amount)`.
      - Otherwise: skip when `!isExpenseTransaction(tx)` (transfer principal), skip when `isSavingsTransaction(tx.category, savingsCategoryNames)`, else accumulate into expense bucket.
      - Build groups sorted by `amount DESC`, tie-break `category ASC` (using `localeCompare`).
      - Sort each group's `transactions` with `compareTransactionDateTimeDesc`.
      - Compute `share = amount / grandTotal` when `grandTotal > 0`, else `0`.
      - Do not mutate the input array or any element.
    - Reuse `isExpenseTransaction` from `@/lib/transaction-classification`, `isSavingsTransaction` from `@/lib/savings-utils`, `compareTransactionDateTimeDesc` from `@/lib/transaction-time`, and `ReportTransactionLike` from `@/lib/report-data`.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.10, 5.11, 5.12, 5.13, 5.14, 5.15, 11.1, 11.2_

  - [x] 1.2 Add `applyDetailsFilters` to `lib/details-data.ts`
    - Implement `applyDetailsFilters(transactions, filters): Transaction[]` with AND semantics across `accountFilter`, `categoryFilter`, and `searchQuery`.
    - `accountFilter` matches `tx.accountId`, `tx.fromAccountId`, or `tx.toAccountId`.
    - `searchQuery` is `trim()`ed, lowercased, and matched against the lowercased `tx.note + " " + tx.category` haystack.
    - Preserve relative input order, do not mutate input or elements.
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.7_

  - [x] 1.3 Add `toggleExpand` to `lib/details-data.ts`
    - Implement `toggleExpand(set: Set<string>, category: string): Set<string>` returning a new Set without mutating the input.
    - Add a default `EMPTY_EXPANDED_KEYS` factory or just use `new Set<string>()` callers.
    - _Requirements: 6.4_

  - [x] 1.4 Property test — Property 1: Total invariance
    - **Property 1: Total Invariance**
    - **Validates: Requirements 5.8**
    - Create `lib/__tests__/details-data.property.test.ts` (or extend it).
    - Use `fast-check` arbitraries for `ReportTransactionLike[]` (mix of `income`, `expense`, `transfer_in/out`, varied categories incl. `"Saldo Awal"`) and `Set<string>` of savings names.
    - Assert `Math.abs(agg.incomeTotal - sum(incomeGroups[i].amount)) < 0.01` and the same for `expenseTotal`/`expenseGroups`.

  - [x] 1.5 Property test — Property 2: Count integrity
    - **Property 2: Count Integrity**
    - **Validates: Requirements 5.9**
    - For every `g ∈ incomeGroups ∪ expenseGroups`, assert `g.count === g.transactions.length`.

  - [x] 1.6 Property test — Property 3: Share normalization
    - **Property 3: Share Normalization**
    - **Validates: Requirements 5.10, 5.11**
    - When tab total > 0, `Math.abs(sum(groups[i].share) - 1) < 0.01`.
    - When tab total === 0, every `g.share === 0`.

  - [x] 1.7 Property test — Property 4: Sort order
    - **Property 4: Sort Order (desc by amount, asc by category tie-break)**
    - **Validates: Requirements 5.13**
    - For all adjacent pairs `(groups[i], groups[i+1])`, assert `amount[i] > amount[i+1]` OR (`amount[i] === amount[i+1]` AND `category[i] <= category[i+1]`).

  - [x] 1.8 Property test — Property 5: Consistency with `aggregatePeriodReport`
    - **Property 5: Consistency with `/dashboard/report`**
    - **Validates: Requirements 5.16, 11.1**
    - Import `aggregatePeriodReport` from `@/lib/report-data`. For every category present in `reportAgg.income` (or `.expense`) with amount `r`, the matching group in `aggregateDetails(...)` has `Math.abs(g.amount - r) < 0.01`.

  - [x] 1.9 Property test — Property 6: Filter idempotency
    - **Property 6: Filter Idempotency**
    - **Validates: Requirements 4.6**
    - For all `txs` and `filters`, `applyDetailsFilters(applyDetailsFilters(txs, filters), filters)` deep-equals `applyDetailsFilters(txs, filters)`.

  - [x] 1.10 Property test — Property 7: Toggle expand involution
    - **Property 7: Toggle Expand Involution**
    - **Validates: Requirements 6.4**
    - For all `set` and `cat`, `toggleExpand(toggleExpand(set, cat), cat)` deep-equals `set`.
    - Also assert input `set` is not mutated (e.g. snapshot before/after).

  - [x] 1.11 Property test — Property 8: Exclusion rules
    - **Property 8: Exclusion Rules in Output**
    - **Validates: Requirements 5.2, 5.5, 5.6**
    - For all `expenseGroups` entries: `g.category !== "Saldo Awal"` and `!isSavingsTransaction(g.category, savingsSet)`.
    - Construct `txs` that include `Saldo Awal`, savings categories, and `transfer_in`/`transfer_out` with non-zero principal; assert their amounts contribute to neither `incomeTotal` nor `expenseTotal`.

  - [x] 1.12 Unit tests for `lib/details-data.ts` edge cases
    - Create `lib/__tests__/details-data.test.ts`.
    - Cases: empty input → all-zero result; mixed income/expense/transfer/savings/`Saldo Awal` filtered correctly; floating-point amounts (e.g. `1234.567`); same-amount tie-break by category; `applyDetailsFilters` AND combinations; `toggleExpand` add then remove returns equivalent set.

- [x] 2. Checkpoint — Logic layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. UI primitives (presentational)
  - [x] 3.1 Implement `TypeTabs` component
    - Create `app/dashboard/details/TypeTabs.tsx`.
    - Props: `{ active, onChange, incomeTotal, expenseTotal, incomeCount, expenseCount }`.
    - Render two pill buttons labeled `"Pemasukan"` and `"Pengeluaran"`. Each shows IDR-formatted total (use the existing currency formatter pattern from `ReportClient`/`TransactionsClient`) and integer transaction count.
    - Empty state: count `0` shows total as `Rp0`.
    - Selected button reflects `active` via `aria-selected="true"` and a visual style.
    - Handler ignores values not in `{"income","expense"}` (parent-side guard recommended; component still calls `onChange` with valid values only).
    - Layout: `flex` container with `flex-wrap` so it wraps below 360px.
    - _Requirements: 2.2, 2.3, 2.4, 2.6, 8.2, 12.1_

  - [x] 3.2 Implement `CategoryRow` component
    - Create `app/dashboard/details/CategoryRow.tsx`.
    - Props: `{ group, type, expanded, onToggle }`.
    - Render category name, IDR total (semantic colors: green for income, destructive for expense), share bar, count badge, chevron rotated by `expanded`.
    - Click and `onKeyDown` Enter/Space call `onToggle`.
    - Set `aria-expanded={expanded}` and `aria-controls={txListId}` where `txListId` is derived from `group.category` (e.g. `details-tx-${slug}`); export the same id helper for `CategoryGroupList` consumption.
    - _Requirements: 6.2, 6.3, 6.7, 12.3, 12.4_

  - [x] 3.3 Implement `CategoryGroupList` component
    - Create `app/dashboard/details/CategoryGroupList.tsx`.
    - Props per design: `{ groups, type, expandedKeys, onToggle, categories, accounts, onDeleteTx, onUpdateTx }`.
    - Render one `CategoryRow` per `group`, collapsed by default; `expanded` is `expandedKeys.has(group.category)`.
    - Lazy-mount the transaction list region only when expanded: render a `<div role="region" id={txListId} aria-labelledby=...>` containing `<TransactionCard />` (from `@/components/TransactionCard`) per `group.transactions[i]`, wired to `onDeleteTx` / `onUpdateTx`. When collapsed, do not include the region in the React tree.
    - Render an inline empty state when `groups.length === 0` saying `"Belum ada {pemasukan|pengeluaran} di periode ini."` and a hint to change the period.
    - _Requirements: 6.1, 6.5, 6.6, 7.1, 9.1_

- [x] 4. Container: `DetailsClient`
  - [x] 4.1 Implement `DetailsClient` (state, fetching, filtering, wiring)
    - Create `app/dashboard/details/DetailsClient.tsx` (`"use client"`).
    - State: `activeTab` (default `"expense"`), `period` (default `"month"`), `customFrom`, `customTo`, `searchQuery`, `accountFilter`, `categoryFilter`, `expandedKeys` (`new Set<string>()`), `transactions`, `accounts`, `categories`, `savingsSet`, `loading`, `error`.
    - Active-tab setter ignores non-`"income"`/`"expense"` values (preserves prior tab; does not mutate `expandedKeys` or fire fetch).
    - Render the top-level layout: `<TypeTabs />`, an inline filter bar (period selector with `"today" | "week" | "month" | "lastMonth" | "custom"`, custom from/to inputs, search input, account dropdown), inline summary strip (IDR total + count for `activeTab`), and `<CategoryGroupList />`.
    - Filter bar layout: 1 column on mobile, 2–4 columns on tablet/desktop via Tailwind grid utilities.
    - Fetch logic via `fetchTx(signal?)`:
      - When `period === "custom"` and both `customFrom` & `customTo` are valid dates with `customFrom <= customTo`, call `/api/record?period=custom&from=${customFrom}&to=${customTo}`.
      - When `period !== "custom"`, call `/api/record?period=${encodeURIComponent(periodToApi(period))}`.
      - When custom range is invalid (empty or unparseable or `customFrom > customTo`), do not fetch and surface helper text `"Pilih tanggal mulai dan akhir yang valid."` near the range inputs.
      - Always pass `cache: "no-store"`.
      - Use a single `AbortController` per dependency change; abort the previous in-flight request before starting a new one.
      - On `AbortError`, leave `transactions` unchanged and do not show error UI.
    - Error handling:
      - 401 with code `token_expired` → render `"Sesi expired. Silakan login ulang."` with a logout/login link.
      - Network/5xx → render an error empty state with a `"Coba lagi"` button that re-runs `fetchTx()` for the active period.
    - Reset `expandedKeys` to a new empty `Set` whenever `activeTab`, `period`, `customFrom`, or `customTo` changes.
    - Filtering & aggregation:
      - `filteredTx` = `useMemo(() => applyDetailsFilters(transactions, { searchQuery, accountFilter, categoryFilter } as DetailsFilters), [...deps])`.
      - `agg` = `useMemo(() => aggregateDetails(filteredTx, savingsSet), [filteredTx, savingsSet])`.
      - Pass `agg.incomeGroups` or `agg.expenseGroups` to `<CategoryGroupList />` based on `activeTab`.
      - Toggle handler: `setExpandedKeys(prev => toggleExpand(prev, cat))`.
    - Data events:
      - Subscribe via `useDataEvent(["transactions", "accounts", "categories"], topic => {...})`. On `"transactions"`, re-run `fetchTx()` for the active period; on `"accounts"`/`"categories"`, refresh those resources.
      - On delete: remove the tx from local state and call `emitDataChanged(["transactions", "budget", "accounts"])`.
      - On update: merge `{...t, ...data}` and call `emitDataChanged(["transactions", "budget", "accounts"])`.
    - Empty/no-match handling:
      - When `transactions.length > 0` but `filteredTx.length === 0`, render `"Tidak ada transaksi yang cocok dengan filter."` with a `"Reset filter"` button that clears `searchQuery`, `accountFilter`, and `categoryFilter`.
    - `accounts` and `categories` are fetched once on mount (in parallel with the first transactions fetch); `savingsSet` is derived from `categories` (lowercased names of categories flagged as savings, matching the convention used by `/api/report/route.ts`).
    - _Requirements: 2.1, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 6.3, 7.2, 7.3, 7.4, 8.1, 8.3, 8.4, 8.5, 9.1, 9.2, 10.1, 10.2, 10.3, 12.2_

  - [x] 4.2 Implement server shell `app/dashboard/details/page.tsx`
    - Export `metadata = { title: "Rincian · BudgetIn" }`.
    - Render the static heading `"Rincian Pemasukan & Pengeluaran"` and the descriptive subline as server-rendered markup.
    - Mount `<DetailsClient />` inside `<Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>` so the fallback covers the main content area until hydration completes.
    - Do not call any data endpoints from the server component.
    - Rely on the existing dashboard route protection (no extra auth code in this file); unauthenticated users are redirected by the existing layout/middleware before this page renders.
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [x] 4.3 Integration test for `DetailsClient`
    - Add `app/dashboard/details/__tests__/DetailsClient.test.tsx`.
    - If not already installed, add `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, and `msw` as devDependencies.
    - Stub `/api/record`, `/api/categories`, `/api/accounts` with `msw`.
    - Cases:
      - Default tab is Pengeluaran (`expense`); `expenseGroups` are rendered after fetch.
      - Clicking the Pemasukan tab swaps to `incomeGroups` and does not trigger a new `/api/record` request.
      - Clicking a category row sets `aria-expanded="true"` and renders a `role="region"` containing the member transactions.
      - Changing period clears expanded state.
      - Search input filters the visible groups.
      - 401 `token_expired` response renders the "Sesi expired" message.
    - _Requirements: 2.1, 2.3, 2.5, 3.6, 4.5, 6.5, 6.7, 10.1_

- [x] 5. Sidebar wiring
  - [x] 5.1 Add `"Rincian"` nav item to `components/Sidebar.tsx`
    - In the `insightsItems` array, insert `{ name: "Rincian", href: "/dashboard/details", icon: ListTree }` between `"Kalender"` and `"Report"` (preserving the order shown in design).
    - Import `ListTree` from `lucide-react` if not already imported.
    - Verify the existing active-state logic highlights the item only when `pathname === "/dashboard/details"`.
    - _Requirements: 1.1_

- [x] 6. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and may be skipped for a faster MVP. Property tests (1.4–1.11) translate the design's correctness properties verbatim and are highly recommended before shipping.
- All non-test sub-tasks reference specific requirement clauses for traceability.
- Each correctness property is a separate task per workflow guidance and is annotated with both its property number and the requirement clause it validates.
- The logic layer (`lib/details-data.ts`) is built first and pinned by tests so React work can proceed against a stable contract.
- No new API routes are introduced; the page reuses `GET /api/record`, `GET /api/categories`, and `GET /api/accounts`.
- `fast-check` and `jest` are already installed; React Testing Library + `msw` are only required if optional task 4.3 is executed.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "5.1"] },
    { "id": 1, "tasks": ["1.2", "3.1", "3.2"] },
    { "id": 2, "tasks": ["1.3", "3.3"] },
    { "id": 3, "tasks": ["1.4", "1.12"] },
    { "id": 4, "tasks": ["1.5"] },
    { "id": 5, "tasks": ["1.6"] },
    { "id": 6, "tasks": ["1.7"] },
    { "id": 7, "tasks": ["1.8"] },
    { "id": 8, "tasks": ["1.9"] },
    { "id": 9, "tasks": ["1.10"] },
    { "id": 10, "tasks": ["1.11"] },
    { "id": 11, "tasks": ["4.1"] },
    { "id": 12, "tasks": ["4.2"] },
    { "id": 13, "tasks": ["4.3"] }
  ]
}
```
