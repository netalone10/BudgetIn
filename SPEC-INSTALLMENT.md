# Spec Teknikal: Fitur Cicilan & Kartu Kredit Limit

> BudgetIn — Personal Finance App
> Author: Akbar Muharram
> Date: 2026-07-12

---

## 1. Overview

### Problem
User beli barang secara cicilan (Shopee, Tokopedia, Kartu Kredit). Saat ini BudgetIn tidak punya cara untuk:
- Mencatat pembelian cicilan secara akuntabel (expense saat beli, liability bertahap)
- Track sisa cicilan, progress, dan freedom date
- Set limit kartu kredit dan lihat utilization

### Solution
Dua fitur yang saling terkait:
1. **Installment Tracker** — input cicilan, system auto-create liability + recurring payment
2. **Credit Card Limit** — set max limit per kartu kredit, tampilkan utilization

### Scope
- Phase 1: Schema changes + Installment input flow
- Phase 2: Dashboard cards (cicilan progress, cashflow projection)
- Phase 3: Credit card limit + utilization + warning

---

## 2. Akuntansi Cicilan

### Double-Entry Flow

```
Tanggal Pembelian (input cicilan):
  DR  Expense (kategori user pilih)     Rp9.000.000
  CR  Hutang (liability account)        Rp9.000.000

Tiap Bulan (auto via recurring-executor):
  DR  Hutang (liability account)        Rp750.000
  CR  Kas/Bank (source account)         Rp750.000
```

### Key Principles
- **Expense dicatat SEKALI** saat input, bukan tiap bulan
- **Cicilan bulanan = transfer kas → settle utang**, bukan expense baru
- Net worth turun saat beli (ada liability), naik pelan-pelan tiap cicilan dibayar
- SafeToSpend tidak terganggu (cicilan bukan variable expense)

---

## 2B. Dual Storage Architecture

BudgetIn mendukung dua storage backend:
- **Google Sheets users** — ledger di Sheets, metadata di Postgres
- **DB users (email/password)** — semua di Postgres

Fitur cicilan HARUS support keduanya. Pola yang sama sudah dipakai di `recurring-executor.ts`.

### Detection
```typescript
const user = await prisma.user.findUnique({ where: { id: userId }, select: { sheetsId: true } });
const isSheetsUser = !!user?.sheetsId;
```

### Storage Mapping

| Entity | Google Sheets | Postgres (DB user) |
--------|---------------|-------------------|
| Liability Account | Append ke sheet "Akun" (kolom A-K) | `prisma.account.create()` |
| Initial Expense | `appendTransaction()` ke sheet "Transaksi" | `prisma.transaction.create()` |
| Monthly Payment | `appendTransaction()` type=expense, from=source, to=liability | `prisma.transaction.create()` type=transfer_out + transfer_in |
| Installment Metadata | Selalu di Postgres (`recurring_transactions` table) | Sama |
| Credit Limit | Kolom baru di sheet "Akun" (kolom L) | `accounts.credit_limit` |
| Occurrence Record | Selalu di Postgres (`recurring_occurrences` table) | Sama |

### Sheets Sign Rule (dari `sheets-ledger.ts`)
Balance liability dihitung dari ledger, bukan dari field `balance`:
```
from leg on liability: +amount  (utang bertambah — initial expense)
to leg on liability:   -amount  (utang berkurang — cicilan dibayar)
```
Artinya: cicilan monthly payment di Sheets ditulis sebagai `type=expense` dengan `fromAccountId=source`, `toAccountId=liability`. Ini otomatis mengurangi balance liability via ledger computation.

### DB Sign Rule
Untuk DB users, cicilan monthly payment ditulis sebagai pasangan transfer:
- `transfer_out` dari source account (asset berkurang)
- `transfer_in` ke liability account (utang berkurang)

### Mirror Pattern (Sheets users)
Sama seperti SavingsContribution: tulis ke Sheets dulu, lalu mirror Transaction ke Postgres untuk FK references (recurring_occurrences.transaction_id). Mirror record punya `id` yang sama dengan Sheets row id.

### Credit Limit di Sheets
Sheet "Akun" header perlu kolom baru:
```
A: id | B: name | C: type | D: classification | E: balance | F: currency | G: color | H: note | I: tanggalSettlement | J: tanggalJatuhTempo | K: creditLimit | L: billingCycleDay
```
`creditLimit` dan `billingCycleDay` disimpan di Sheets, di-parse saat `getAccounts()`.

---

## 3. Database Schema Changes

### 3.1 Account Model — Add Credit Card Limit

```prisma
model Account {
  // ... existing fields ...

  // === Kartu Kredit Fields (existing) ===
  tanggalSettlement Int? @map("tanggal_settlement") // 1-31
  tanggalJatuhTempo Int? @map("tanggal_jatuh_tempo") // 1-31

  // === Kartu Kredit Fields (NEW) ===
  creditLimit     Decimal? @map("credit_limit") @db.Decimal(19, 4)  // max limit
  billingCycleDay Int?     @map("billing_cycle_day") // 1-31, default = tanggalSettlement
}
```

**Migration:**
```sql
ALTER TABLE accounts
  ADD COLUMN credit_limit DECIMAL(19,4),
  ADD COLUMN billing_cycle_day INT;
```

### 3.2 Sheets Schema Changes (Google Sheets users)

#### "Akun" Sheet — Tambah 2 Kolom
**Existing header (A-J):**
```
id | name | type | classification | balance | currency | color | note | tanggalSettlement | tanggalJatuhTempo
```

**New header (A-L):**
```
id | name | type | classification | balance | currency | color | note | tanggalSettlement | tanggalJatuhTempo | creditLimit | billingCycleDay
```

#### `AccountData` Interface Update (`utils/sheets.ts`)
```typescript
export interface AccountData {
  // ... existing fields ...
  creditLimit: number | null;       // NEW — kolom K
  billingCycleDay: number | null;   // NEW — kolom L
}
```

#### Changes needed di `utils/sheets.ts`:
- `appendAccount()`: row array tambah `data.creditLimit ?? ""`, `data.billingCycleDay ?? ""`
- `updateAccount()`: range extend dari `A:J` ke `A:L`, updated array tambah 2 field
- `createGoogleSheet()`: header "Akun" tambah `creditLimit`, `billingCycleDay`
- `getAccounts()`: parse kolom K-L: `parseFloat(row[10]) || null`

#### Backward Compatibility
- Kolom K-L kosong untuk existing accounts → parsed as `null`
- Existing users tidak perlu migrate, kolom otomatis muncul saat header di-update

### 3.3 RecurringTransaction Model — Add Installment Metadata

```prisma
model RecurringTransaction {
  // ... existing fields ...

  // === Installment Fields (NEW) ===
  installmentTotal    Decimal?  @map("installment_total") @db.Decimal(19, 4) // total harga barang
  installmentPaid     Int?      @map("installment_paid") @default(0)          // sudah bayar N kali
  installmentTenor    Int?      @map("installment_tenor")                      // total cicilan (e.g. 12)
  installmentSource   String?   @map("installment_source")                     // "shopee", "tokopedia", "manual"
  liabilityAccountId  String?   @map("liability_account_id")                   // FK ke Account (liability type)
}
```

**Migration:**
```sql
ALTER TABLE recurring_transactions
  ADD COLUMN installment_total DECIMAL(19,4),
  ADD COLUMN installment_paid INT DEFAULT 0,
  ADD COLUMN installment_tenor INT,
  ADD COLUMN installment_source VARCHAR(100),
  ADD COLUMN liability_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL;

CREATE INDEX idx_recurring_liability_account
  ON recurring_transactions(liability_account_id);
```

### 3.3 Computed Fields (tidak di DB, dihitung)

```typescript
// Computed dari installmentTotal, installmentPaid, installmentTenor, amount
interface InstallmentMeta {
  totalAmount: number;         // installmentTotal
  tenor: number;               // installmentTenor
  paid: number;                // installmentPaid
  remaining: number;           // tenor - paid
  monthlyAmount: number;       // amount (dari RecurringTransaction)
  outstandingDebt: number;     // total - (paid × monthlyAmount)
  progressPercent: number;     // (paid / tenor) × 100
  freedomDate: Date;           // startDate + tenor months
  startDate: Date;
  endDate: Date;
}
```

---

## 4. API Endpoints

### 4.1 Cicilan Input

**POST `/api/installments`**

```typescript
// Request
interface CreateInstallmentRequest {
  name: string;              // "iPhone 16"
  totalAmount: number;       // 9000000
  tenor: number;             // 12
  startMonth: string;        // "2026-08" (YYYY-MM)
  sourceAccountId: string;   // BCA account ID
  categoryId: string;        // "Elektronik" category ID
  note?: string;
  source?: string;           // "shopee", "tokopedia", "manual"
}

// Response
interface CreateInstallmentResponse {
  recurring: RecurringTransaction;
  liabilityAccount: Account;
  initialTransaction: Transaction;
  meta: InstallmentMeta;
}
```

**Logic:**
1. Detect storage: `isSheetsUser = !!user.sheetsId`

2. Create liability Account (type = "Hutang"):
   - `name`: "Cicilan {name}"
   - `initialBalance`: -totalAmount
   - `classification`: "liability"

   **Sheets path:** `appendAccount(sheetsId, accessToken, { name, type: "Hutang", classification: "liability", balance: -totalAmount, ... })`
   + mirror ke Postgres `prisma.account.create()` dengan `id` yang sama

   **DB path:** `prisma.account.create()` langsung

3. Create Transaction (expense) — tanggal hari ini:
   - `amount`: totalAmount
   - `category`: user-selected
   - `type`: "expense"
   - `date`: today

   **Sheets path:** `appendTransaction(sheetsId, accessToken, { date, amount, category, type: "expense", fromAccountId: liabilityAccount.id, fromAccountName: liabilityAccount.name })`
   + mirror ke Postgres `prisma.transaction.create()` dengan `id` yang sama

   **DB path:** `prisma.transaction.create()` dengan `accountId: null`

4. Create RecurringTransaction (selalu Postgres):
   - `type`: "expense"
   - `amount`: totalAmount / tenor
   - `frequency`: "monthly"
   - `startDate`: 1st of startMonth
   - `endDate`: startMonth + tenor months
   - `installmentTotal`: totalAmount
   - `installmentTenor`: tenor
   - `installmentPaid`: 0
   - `liabilityAccountId`: liability account ID
   - `autoRecord`: false (user confirm tiap bulan, atau true untuk full auto)

### 4.2 Cicilan List

**GET `/api/installments`**

```typescript
interface InstallmentListItem {
  id: string;
  name: string;
  totalAmount: number;
  tenor: number;
  paid: number;
  remaining: number;
  monthlyAmount: number;
  outstandingDebt: number;
  progressPercent: number;
  freedomDate: string;
  startDate: string;
  source: string | null;
  liabilityAccountId: string;
  liabilityBalance: number;
  nextDueDate: string;
  isActive: boolean;
}
```

### 4.3 Cicilan Summary (Dashboard)

**GET `/api/installments/summary`**

```typescript
interface InstallmentSummary {
  activeCount: number;
  totalMonthlyPayment: number;
  totalOutstandingDebt: number;
  nextFreedomDate: string | null;       // cicilan terakhir lunas
  installmentToIncomeRatio: number | null; // % dari income bulan ini
  items: InstallmentListItem[];
  projection: MonthProjection[];        // 12 bulan ke depan
}

interface MonthProjection {
  month: string;           // "2026-08"
  totalPayment: number;    // total cicilan bulan itu
  activeCount: number;     // cicilan aktif
  freedCount: number;      // lunas bulan itu
  freedAmount: number;     // yang lega
}
```

### 4.4 Credit Card Limit

**PATCH `/api/accounts/[accountId]`**

Extend existing endpoint, tambah field:

```typescript
// Request (partial update)
interface UpdateAccountRequest {
  // ... existing fields ...
  creditLimit?: number;        // null = hapus limit
  billingCycleDay?: number;    // 1-31
}
```

**GET `/api/accounts/[accountId]/credit-utilization`**

```typescript
interface CreditUtilization {
  accountId: string;
  accountName: string;
  creditLimit: number | null;
  currentBalance: number;      // outstanding
  availableCredit: number;     // limit - balance
  utilizationPercent: number;  // (balance / limit) × 100
  billingCycleDay: number | null;
  nextBillingDate: string | null;
  tanggalJatuhTempo: number | null;
  warning: "none" | "approaching" | "over_limit";
}
```

---

## 5. UI Components

### 5.1 InstallmentInputModal

**Location:** `components/InstallmentInputModal.tsx`

**Trigger:** Tombol "+" di sidebar / halaman Recurring → dropdown "Tambah Cicilan"

**Layout:**
```
┌─────────────────────────────────────────┐
│  Tambah Cicilan                    [X]  │
│                                         │
│  Nama Barang *                          │
│  ┌───────────────────────────────────┐  │
│  │ iPhone 16                         │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Total Harga *                          │
│  ┌───────────────────────────────────┐  │
│  │ Rp 9.000.000                      │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Tenor Cicilan *                        │
│  ┌─────────┐                            │
│  │ 12      │ bulan                      │
│  └─────────┘                            │
│                                         │
│  Mulai Cicilan *                        │
│  ┌───────────────────────────────────┐  │
│  │ Agustus 2026               ▼      │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Sumber Pembayaran *                    │
│  ┌───────────────────────────────────┐  │
│  │ BCA                       ▼      │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Kategori *                             │
│  ┌───────────────────────────────────┐  │
│  │ Elektronik                 ▼      │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Sumber Cicilan                         │
│  ┌───────────────────────────────────┐  │
│  │ Shopee                     ▼      │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ── Preview ─────────────────────────── │
│  ┌───────────────────────────────────┐  │
│  │  Cicilan/bulan    Rp 750.000      │  │
│  │  Total cicilan    12x             │  │
│  │  Lunas            Juli 2027       │  │
│  │  Hutang baru      Rp 9.000.000    │  │
│  └───────────────────────────────────┘  │
│                                         │
│         [Batal]  [Simpan Cicilan]       │
└─────────────────────────────────────────┘
```

**Behavior:**
- Total & Tenor onChange → hitung preview otomatis
- Source Account: filter hanya tipe "Bank", "E-Wallet", "Kartu Kredit"
- Kategori: filter hanya tipe "expense"
- Source Cicilan: dropdown preset (Shopee, Tokopedia, Lazada, Manual, dll)
- Simpan → hit POST `/api/installments`

### 5.2 InstallmentDashboardCard

**Location:** `components/dashboard/InstallmentDashboardCard.tsx`

```
┌─────────────────────────────────────────┐
│  📋 Cicilan Aktif              3 aktif  │
│                                         │
│  Total per bulan: Rp 1.795.821         │
│  Total utang:     Rp 17.383.314        │
│  Lunas terakhir:  Agustus 2027         │
│                                         │
│  ── iPhone 16 ─────────── 1/12 ── 8% ─ │
│  ████████░░░░░░░░░░░░░░░░  Rp750.000/bln│
│                                         │
│  ── Shopee Order ──────── 16/24 ─ 67% ─│
│  ████████████████░░░░░░░░  Rp208.333/bln│
│                                         │
│  ── Tokopedia Order ───── 1/12 ── 8% ──│
│  ████████░░░░░░░░░░░░░░░░  Rp833.321/bln│
│                                         │
│  [Lihat Detail →]                       │
└─────────────────────────────────────────┘
```

**Props:**
```typescript
interface InstallmentDashboardCardProps {
  items: InstallmentListItem[];
  totalMonthly: number;
  totalOutstanding: number;
  freedomDate: string | null;
}
```

### 5.3 CashflowProjectionCard

**Location:** `components/dashboard/CashflowProjectionCard.tsx`

```
┌─────────────────────────────────────────┐
│  📊 Proyeksi Cicilan 12 Bulan          │
│                                         │
│  Agt'26  ████████████████  Rp1.795.821 │
│  Sep'26  ████████████████  Rp1.795.821 │
│  ...                                    │
│  Apr'27  ████████████░░░░  Rp1.587.488 │  ← Shopee lunas
│  ...                                    │
│  Jul'27  ████████░░░░░░░░  Rp750.000   │  ← Tokopedia lunas
│  Agu'27  ░░░░░░░░░░░░░░░░  Rp0         │  ← Semua lunas 🎉
│                                         │
│  [Expand →]                             │
└─────────────────────────────────────────┘
```

### 5.4 Credit Card Limit UI

**Location:** Extend `components/SetupAccountsModal.tsx` + `app/dashboard/accounts/` page

**Account Detail — Kartu Kredit:**
```
┌─────────────────────────────────────────┐
│  💳 Kartu Kredit BNI                    │
│                                         │
│  Limit:        Rp 15.000.000           │
│  Terpakai:     Rp 9.000.000            │
│  Tersedia:     Rp 6.000.000            │
│                                         │
│  ████████████████░░░░░░░░  60%          │
│                                         │
│  ⚠️ Utilization >50%                    │
│                                         │
│  Tanggal Settlement:  15                │
│  Tanggal Jatuh Tempo: 25                │
│                                         │
│  [Edit Limit]                           │
└─────────────────────────────────────────┘
```

**Warning Thresholds:**
- `<50%` → hijau (sehat)
- `50-75%` → kuning (waspada)
- `75-90%` → orange (bahaya)
- `>90%` → merah (over-limit warning)

### 5.5 Installment Detail Page

**Location:** `app/dashboard/installments/[id]/page.tsx`

```
┌─────────────────────────────────────────┐
│  ← Kembali                              │
│                                         │
│  iPhone 16                              │
│  Shopee · Elektronik                    │
│                                         │
│  Rp 9.000.000                           │
│  ████████████████░░░░░░░░  8% (1/12)   │
│                                         │
│  ── Detail ─────────────────────────────│
│  Cicilan/bulan:  Rp 750.000            │
│  Sudah dibayar:  Rp 750.000            │
│  Sisa utang:     Rp 8.250.000          │
│  Mulai:          Agustus 2026           │
│  Lunas:          Juli 2027             │
│  Sumber:         BCA                    │
│                                         │
│  ── Riwayat Pembayaran ─────────────────│
│  01 Agu 2026  Rp 750.000  ✓ Sudah      │
│  01 Sep 2026  Rp 750.000  ○ Jadwal     │
│  01 Okt 2026  Rp 750.000  ○ Jadwal     │
│  ...                                    │
│                                         │
│  [Edit]  [Hapus Cicilan]               │
└─────────────────────────────────────────┘
```

---

## 6. Backend Logic Changes

### 6.1 Modified: `recurring-executor.ts`

**Current behavior:** Creates expense transaction every occurrence.

**New behavior (for installment type):**

```typescript
// In runRecurringOccurrence(), after checking installment metadata:

if (r.installmentTotal && r.installmentTenor && r.liabilityAccountId) {
  // INSTALLMENT PATH: transfer kas → settle utang
  // Bukan expense baru, hanya perpindahan kas

  // ── SHEETS PATH ──
  if (user?.sheetsId) {
    const appended = await appendTransaction(user.sheetsId, accessToken, {
      date: dateStr,
      time,
      amount: amountNum,
      category: "Cicilan",
      note: `${r.name} (cicilan ${r.installmentPaid! + 1}/${r.installmentTenor})`,
      type: "expense",
      fromAccountId: r.accountId,              // source (BCA)
      fromAccountName: r.account?.name,
      toAccountId: r.liabilityAccountId,       // liability account
      toAccountName: `Cicilan ${r.name}`,
    });
    // Ledger otomatis: source -amount, liability -amount (via to leg sign rule)

    // Mirror ke Postgres untuk FK
    await tx.transaction.create({
      data: {
        id: appended.id,  // same ID as Sheets row
        userId: r.userId,
        date: dateStr,
        time,
        amount,
        category: "Cicilan",
        note,
        type: "expense",
      },
    });
  }

  // ── DB PATH ──
  else {
    const transferId = randomUUID();
    await tx.transaction.create({
      data: {
        userId: r.userId,
        accountId: r.accountId,           // source (BCA)
        type: "transfer_out",
        amount,
        category: "Cicilan",
        date: dateStr,
        note: `${r.name} (cicilan ${r.installmentPaid! + 1}/${r.installmentTenor})`,
        transferId,
      },
    });
    await tx.transaction.create({
      data: {
        userId: r.userId,
        accountId: r.liabilityAccountId,  // liability
        type: "transfer_in",
        amount,
        category: "Cicilan",
        date: dateStr,
        note,
        transferId,
      },
    });
  }

  // Increment installmentPaid
  await tx.recurringTransaction.update({
    where: { id: r.id },
    data: {
      installmentPaid: { increment: 1 },
      lastRunAt: occurredDay,
      nextDueDate,
    },
  });

  // Check if fully paid
  if (r.installmentPaid! + 1 >= r.installmentTenor) {
    await tx.recurringTransaction.update({
      where: { id: r.id },
      data: { isActive: false },  // auto-deactivate
    });
  }
}
```

### 6.2 Modified: `analyst-metrics.ts`

Add cicilan transfer exclusion from expense counting:

```typescript
// In computeAnalystMetrics():
if (t.category === "Cicilan" && t.type === "transfer_out") {
  // Ini bukan expense, cuma settle utang
  continue;
}
```

### 6.3 Modified: `account-balance.ts`

Credit card limit computation:

```typescript
function computeCreditUtilization(account: Account): CreditUtilization {
  const limit = account.creditLimit?.toNumber() ?? null;
  const balance = Math.abs(account.currentBalance); // outstanding debt

  return {
    creditLimit: limit,
    currentBalance: balance,
    availableCredit: limit ? limit - balance : null,
    utilizationPercent: limit ? (balance / limit) * 100 : null,
    warning: !limit ? "none"
      : balance / limit > 0.9 ? "over_limit"
      : balance / limit > 0.75 ? "approaching"
      : "none",
  };
}
```

### 6.4 New: `lib/installment-utils.ts`

```typescript
export function computeInstallmentMeta(
  total: number,
  tenor: number,
  paid: number,
  monthlyAmount: number,
  startDate: Date,
): InstallmentMeta {
  const remaining = tenor - paid;
  const outstandingDebt = total - (paid * monthlyAmount);
  const progressPercent = Math.round((paid / tenor) * 100);
  const freedomDate = addMonths(startDate, tenor);

  return {
    totalAmount: total,
    tenor,
    paid,
    remaining,
    monthlyAmount,
    outstandingDebt,
    progressPercent,
    freedomDate,
    startDate,
    endDate: freedomDate,
  };
}

export function computeProjection(
  installments: InstallmentListItem[],
  months: number = 12,
): MonthProjection[] {
  const now = new Date();
  const projections: MonthProjection[] = [];

  for (let i = 0; i < months; i++) {
    const month = addMonths(now, i);
    const monthStr = format(month, "yyyy-MM");

    let totalPayment = 0;
    let activeCount = 0;
    let freedCount = 0;
    let freedAmount = 0;

    for (const inst of installments) {
      if (!inst.isActive) continue;
      const instStart = new Date(inst.startDate);
      const instEnd = new Date(inst.freedomDate);

      if (month >= instStart && month <= instEnd) {
        totalPayment += inst.monthlyAmount;
        activeCount++;
      }
      // Check if this month is the last payment
      if (format(instEnd, "yyyy-MM") === monthStr) {
        freedCount++;
        freedAmount += inst.monthlyAmount;
      }
    }

    projections.push({ month: monthStr, totalPayment, activeCount, freedCount, freedAmount });
  }

  return projections;
}
```

---

## 7. File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `app/api/installments/route.ts` | POST (create), GET (list) |
| `app/api/installments/summary/route.ts` | GET (dashboard summary) |
| `app/api/installments/[id]/route.ts` | GET (detail), PATCH (edit), DELETE |
| `lib/installment-utils.ts` | Pure computation helpers |
| `components/InstallmentInputModal.tsx` | Input form modal |
| `components/dashboard/InstallmentDashboardCard.tsx` | Dashboard card |
| `components/dashboard/CashflowProjectionCard.tsx` | 12-month projection |
| `components/CreditUtilizationCard.tsx` | CC limit + utilization |
| `app/dashboard/installments/page.tsx` | Installment list page |
| `app/dashboard/installments/[id]/page.tsx` | Installment detail page |

### Modified Files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add installment fields + credit limit |
| `utils/recurring-executor.ts` | Installment payment path (dual: Sheets + DB) |
| `lib/analyst-metrics.ts` | Exclude cicilan transfer from expense |
| `lib/dashboard-data.ts` | Fetch installment summary |
| `app/dashboard/DashboardClient.tsx` | Render installment cards |
| `components/Sidebar.tsx` | Add "Cicilan" nav item |
| `components/AddRecurringModal.tsx` | Detect if recurring is installment |
| `app/api/accounts/[accountId]/route.ts` | PATCH credit limit fields |
| `components/SetupAccountsModal.tsx` | Credit limit input for CC type |
| `utils/account-balance.ts` | Credit utilization computation |
| `utils/sheets.ts` | AccountData +creditLimit/billingCycleDay, appendAccount/updateAccount/createGoogleSheet range A→L |
| `utils/sheets-ledger.ts` | (no change — sign rule sudah support liability to-leg) |
| `lib/sheets-data.ts` | (no change — getAccounts() auto-parse kolom baru) |

---

## 8. User Flow

### Flow 1: Input Cicilan Baru
```
User → Sidebar → "Cicilan" → "Tambah Cicilan"
  → InstallmentInputModal muncul
  → Isi: nama, total, tenor, mulai, sumber, kategori
  → Preview otomatis: cicilan/bln, lunas kapan
  → Klik "Simpan Cicilan"
  → System create: expense + liability account + recurring
  → Redirect ke installment detail page
```

### Flow 2: Cicilan Auto-Run Tiap Bulan
```
Cron job / User klik "Catat"
  → recurring-executor detect installment type
  → Create transfer_out dari source account
  → Reduce liability balance
  → Increment installmentPaid
  → Kalau sudah lunas → deactivate recurring
  → Dashboard auto-refresh
```

### Flow 3: Set Credit Card Limit
```
User → Accounts → Kartu Kredit BNI → Edit
  → Tambah field "Limit Kartu Kredit"
  → Input: Rp15.000.000
  → Save
  → Dashboard: utilization card muncul
  → Warning kalau >75%
```

### Flow 4: Lihat Proyeksi
```
User → Dashboard
  → CashflowProjectionCard auto-render
  → Lihat bulan mana cicilan overlap
  → Lihat kapan cicilan lunas satu-satu
```

---

## 9. Testing Checklist

### Unit Tests
- [ ] `computeInstallmentMeta()` — correct outstanding, progress, freedom date
- [ ] `computeProjection()` — correct month-by-month breakdown
- [ ] `computeCreditUtilization()` — correct utilization %, warning levels
- [ ] `recurring-executor` installment path — creates transfer, not expense
- [ ] `analyst-metrics` — cicilan transfer excluded from expense total

### Integration Tests
- [ ] POST `/api/installments` — creates all 3 records (expense, liability, recurring)
- [ ] Recurring run — increments installmentPaid, reduces liability
- [ ] Final run — deactivates recurring when paid
- [ ] PATCH `/api/accounts/[id]` — credit limit update works
- [ ] Dashboard — installment card renders correctly

### Dual Storage Tests
- [ ] Sheets user: liability account created in "Akun" sheet + Postgres mirror
- [ ] Sheets user: initial expense appended to "Transaksi" sheet + Postgres mirror
- [ ] Sheets user: monthly payment appended with from=source, to=liability → ledger balance correct
- [ ] Sheets user: credit limit persists in sheet "Akun" kolom K
- [ ] DB user: liability account created in Postgres only
- [ ] DB user: monthly payment creates transfer_out + transfer_in pair
- [ ] Backward compat: existing "Akun" sheet without kolom K-L → creditLimit=null
### E2E Tests
- [ ] Full cicilan lifecycle: input → monthly run → lunas
- [ ] Credit card limit set → utilization shows → warning triggers
- [ ] Net worth reflects liability correctly

---

## 10. Migration Strategy

### Step 1: Schema Migration (zero-downtime)
```bash
# Add columns as nullable (no data loss)
npx prisma migrate dev --name add-installment-fields
npx prisma migrate dev --name add-credit-limit
```

### Step 1B: Sheets Migration (otomatis)
- `createGoogleSheet()`: header sudah include kolom K-L untuk user baru
- Existing users: `getAccounts()` auto-handle missing kolom (returns null)
- `appendAccount()` / `updateAccount()`: range sudah extend ke A-L
- Tidak perlu batch migrate existing sheets — backward compatible by design

### Step 2: Deploy API (backward-compatible)
- New endpoints don't break existing functionality
- Existing recurring transactions: `installmentTotal` = null → treated as regular recurring

### Step 3: Deploy UI (feature flag optional)
- Installment modal: accessible from sidebar
- Dashboard cards: only render if installments exist
- Credit limit: only shows for Kartu Kredit type accounts

### Step 4: Backfill (optional)
- Existing "Cicilan" category transactions → user can retroactively link to installments
- Not required for MVP, user can start fresh

---

## 11. Future Enhancements (Out of Scope)

- [ ] Cicilan dari Kartu Kredit (expense ke CC, bukan kas)
- [ ] Notifikasi H-3 sebelum jatuh tempo cicilan
- [ ] "What-if" simulator: tambah cicilan baru, impact ke cashflow
- [ ] Import cicilan dari struk/notifikasi (OCR)
- [ ] Cicilan dengan bunga (floating rate)
- [ ] Family mode: cicilan bersama (suami-istri)
