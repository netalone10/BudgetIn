# Task List: Fitur Cicilan & Kartu Kredit Limit — BudgetIn

> Source: SPEC-INSTALLMENT.md
> Status: ⬜ = Not started | 🔵 = In Progress | ✅ = Done

---

## Phase 1: Schema & Infrastructure

### 1.1 Database Schema (Prisma)
- ⬜ Add `creditLimit` (Decimal?) ke model Account
- ⬜ Add `billingCycleDay` (Int?) ke model Account
- ⬜ Add `installmentTotal` (Decimal?) ke model RecurringTransaction
- ⬜ Add `installmentPaid` (Int?, default 0) ke model RecurringTransaction
- ⬜ Add `installmentTenor` (Int?) ke model RecurringTransaction
- ⬜ Add `installmentSource` (String?) ke model RecurringTransaction
- ⬜ Add `liabilityAccountId` (String?, FK ke Account) ke model RecurringTransaction
- ⬜ Run `npx prisma migrate dev --name add-installment-and-cc-limit`
- ⬜ Verify migration: nullable columns, no data loss, indexes created

### 1.2 Google Sheets Schema
- ⬜ Update `AccountData` interface: +`creditLimit`, +`billingCycleDay`
- ⬜ Update `appendAccount()`: row array extend A→L
- ⬜ Update `updateAccount()`: range extend A→L, updated array +2 field
- ⬜ Update `createGoogleSheet()`: header "Akun" tambah `creditLimit`, `billingCycleDay`
- ⬜ Update `getAccounts()`: parse kolom K-L (`parseFloat(row[10]) || null`)
- ⬜ Test backward compat: existing sheet tanpa kolom K-L → returns null

---

## Phase 2: Backend — Installment API

### 2.1 Installment Utils (Pure Functions)
- ⬜ Create `lib/installment-utils.ts`
- ⬜ `computeInstallmentMeta()` — outstanding, progress, freedom date
- ⬜ `computeProjection()` — 12-month cashflow projection
- ⬜ `computeCreditUtilization()` — limit, available, %, warning level
- ⬜ Unit tests: `lib/__tests__/installment-utils.test.ts`

### 2.2 Create Installment Endpoint
- ⬜ Create `app/api/installments/route.ts` — POST handler
- ⬜ Detect storage: `isSheetsUser = !!user.sheetsId`
- ⬜ Sheets path: liability account → `appendAccount()` + Postgres mirror
- ⬜ DB path: liability account → `prisma.account.create()`
- ⬜ Sheets path: initial expense → `appendTransaction()` + Postgres mirror
- ⬜ DB path: initial expense → `prisma.transaction.create()`
- ⬜ Create RecurringTransaction with installment metadata (selalu Postgres)
- ⬜ Response: recurring + liabilityAccount + initialTransaction + meta
- ⬜ Integration test: Sheets user flow
- ⬜ Integration test: DB user flow

### 2.3 List & Summary Endpoints
- ⬜ Create `app/api/installments/route.ts` — GET handler (list all active)
- ⬜ Create `app/api/installments/summary/route.ts` — GET handler (dashboard data)
- ⬜ Include projection data (12 bulan ke depan)
- ⬜ Compute `installmentToIncomeRatio` dari transaksi income bulan ini

### 2.4 Detail & Edit Endpoints
- ⬜ Create `app/api/installments/[id]/route.ts` — GET (detail + payment history)
- ⬜ Create `app/api/installments/[id]/route.ts` — PATCH (edit cicilan)
- ⬜ Create `app/api/installments/[id]/route.ts` — DELETE (hapus cicilan)
- ⬜ Delete logic: deactivate recurring + optionally delete liability account

### 2.5 Modified: Recurring Executor
- ⬜ Update `utils/recurring-executor.ts` — detect installment type
- ⬜ Sheets path: `appendTransaction()` with from=source, to=liability
- ⬜ Sheets path: mirror Transaction ke Postgres
- ⬜ DB path: create transfer_out + transfer_in pair
- ⬜ Increment `installmentPaid` setiap occurrence
- ⬜ Auto-deactivate recurring saat `installmentPaid >= installmentTenor`
- ⬜ Integration test: Sheets user monthly payment
- ⬜ Integration test: DB user monthly payment
- ⬜ Integration test: final payment → auto-deactivate

### 2.6 Modified: Analyst Metrics
- ⬜ Update `lib/analyst-metrics.ts` — exclude cicilan category dari expense counting
- ⬜ Condition: `category === "Cicilan"` → skip (bukan expense, cuma settle utang)
- ⬜ Unit test: cicilan transfer tidak masuk totalSpent

---

## Phase 3: Backend — Credit Card Limit

### 3.1 Account API Update
- ⬜ Update `app/api/accounts/[accountId]/route.ts` — PATCH: accept `creditLimit`, `billingCycleDay`
- ⬜ Sheets path: `updateAccount()` dengan field baru
- ⬜ DB path: `prisma.account.update()` dengan field baru
- ⬜ Create `app/api/accounts/[accountId]/credit-utilization/route.ts` — GET handler

### 3.2 Account Balance Utils
- ⬜ Update `utils/account-balance.ts` — add `computeCreditUtilization()`
- ⬜ Warning thresholds: <50% hijau, 50-75% kuning, 75-90% orange, >90% merah

---

## Phase 4: Frontend — Installment UI

### 4.1 Installment Input Modal
- ⬜ Create `components/InstallmentInputModal.tsx`
- ⬜ Form fields: nama, total, tenor, startMonth, sourceAccount, category, source
- ⬜ Preview panel: cicilan/bln, total cicilan, lunas date, hutang baru
- ⬜ Total & tenor onChange → hitung preview otomatis
- ⬜ Source Account filter: hanya Bank, E-Wallet, Kartu Kredit
- ⬜ Category filter: hanya tipe expense
- ⬜ Source dropdown: Shopee, Tokopedia, Lazada, Manual, dll
- ⬜ Submit → POST `/api/installments`
- ⬜ Success → redirect ke installment detail page

### 4.2 Installment Dashboard Card
- ⬜ Create `components/dashboard/InstallmentDashboardCard.tsx`
- ⬜ Show: active count, total/bln, total utang, lunas terakhir
- ⬜ Progress bar per cicilan (nama, X/Y, %, Rp/bln)
- ⬜ Link ke installment list page
- ⬜ Empty state: "Belum ada cicilan"

### 4.3 Cashflow Projection Card
- ⬜ Create `components/dashboard/CashflowProjectionCard.tsx`
- ⬜ 12-month horizontal timeline
- ⬜ Bar per bulan: total cicilan bulan itu
- ⬜ Highlight bulan lunas (freedCount > 0)
- ⬜ Expand → detail per bulan

### 4.4 Installment List Page
- ⬜ Create `app/dashboard/installments/page.tsx`
- ⬜ List semua cicilan aktif + selesai
- ⬜ Sort: active first, by endDate asc
- ⬜ Quick stats: total monthly, total outstanding

### 4.5 Installment Detail Page
- ⬜ Create `app/dashboard/installments/[id]/page.tsx`
- ⬜ Detail: nama, total, tenor, progress bar
- ⬜ Stats: cicilan/bln, sudah dibayar, sisa utang
- ⬜ Payment history: occurrence list dengan status
- ⬜ Edit button → EditInstallmentModal
- ⬜ Delete button → confirm dialog

### 4.6 Dashboard Integration
- ⬜ Update `lib/dashboard-data.ts` — fetch installment summary
- ⬜ Update `app/dashboard/DashboardClient.tsx` — render installment cards
- ⬜ Update `components/Sidebar.tsx` — add "Cicilan" nav item
- ⬜ Position: setelah "Recurring", sebelum "Laporan"

---

## Phase 5: Frontend — Credit Card Limit UI

### 5.1 Account Setup Update
- ⬜ Update `components/SetupAccountsModal.tsx` — add credit limit input untuk Kartu Kredit type
- ⬜ Condition: hanya muncul kalau account type = "Kartu Kredit"
- ⬜ Field: "Limit Kartu Kredit" (number input, format IDR)

### 5.2 Credit Utilization Card
- ⬜ Create `components/CreditUtilizationCard.tsx`
- ⬜ Show: limit, terpakai, tersedia, utilization %
- ⬜ Progress bar dengan warna threshold
- ⬜ Warning badge kalau >75%
- ⬜ Tanggal settlement & jatuh tempo
- ⬜ "Edit Limit" button

### 5.3 Account Detail Integration
- ⬜ Update account detail page — render CreditUtilizationCard untuk tipe Kartu Kredit
- ⬜ Update account edit flow — allow edit credit limit

---

## Phase 6: Testing & Polish

### 6.1 Unit Tests
- ⬜ `computeInstallmentMeta()` — correct outstanding, progress, freedom date
- ⬜ `computeProjection()` — correct month-by-month breakdown
- ⬜ `computeCreditUtilization()` — correct utilization %, warning levels
- ⬜ `analyst-metrics` — cicilan excluded from expense total

### 6.2 Integration Tests
- ⬜ POST `/api/installments` — Sheets user: creates all 3 records + sheet entries
- ⬜ POST `/api/installments` — DB user: creates all 3 records in Postgres
- ⬜ Recurring run — Sheets user: append + mirror + increment
- ⬜ Recurring run — DB user: transfer pair + increment
- ⬜ Final run — auto-deactivate
- ⬜ PATCH credit limit — both paths

### 6.3 Dual Storage Tests
- ⬜ Sheets: liability in "Akun" sheet + Postgres mirror
- ⬜ Sheets: expense in "Transaksi" sheet + Postgres mirror
- ⬜ Sheets: monthly payment from=source, to=liability → ledger correct
- ⬜ Sheets: credit limit in kolom K
- ⬜ DB: liability in Postgres
- ⬜ DB: monthly payment transfer pair
- ⬜ Backward compat: sheet tanpa kolom K-L → null

### 6.4 E2E Tests
- ⬜ Full lifecycle: input cicilan → monthly run → lunas → auto-deactivate
- ⬜ Credit card limit → utilization display → warning trigger
- ⬜ Net worth: turun saat beli, naik pelan-pelan

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| 1. Schema & Infrastructure | 14 | ⬜ |
| 2. Installment API | 20 | ⬜ |
| 3. Credit Card API | 5 | ⬜ |
| 4. Installment UI | 16 | ⬜ |
| 5. Credit Card UI | 7 | ⬜ |
| 6. Testing & Polish | 16 | ⬜ |
| **Total** | **78** | ⬜ |
