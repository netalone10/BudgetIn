# Redesign v4: Account-Based Bookkeeping + Customizable Types

> Perubahan dari v3: 5 perbaikan kritis dari code review — Decimal type, soft-delete guard, cross-currency block, initial balance sebagai transaksi, dan Groq alias mapping.

---

## Context

BudgetIn cash basis murni → account-based bookkeeping dengan double-entry transfer. Setiap transaksi memengaruhi saldo akun, transfer antar akun dicatat 2 row linked via `transferId`, net worth = aset minus liability real-time.

Tipe akun user-managed: sistem seed 10 default saat signup, user bebas rename/tambah/hapus. Sistem hanya mengunci `classification: "asset" | "liability"` untuk math net worth.

Semantik transaksi:
- `income`: tambah saldo akun
- `expense`: kurangi saldo akun
- `transfer_out` + `transfer_in`: double-entry, net worth tidak berubah
- `initial_balance`: income otomatis saat akun dibuat dengan saldo awal > 0 (lihat Phase 2)

---

## Keputusan Desain

| Aspek | Keputusan | Alasan |
|-------|-----------|--------|
| Tipe data uang | `Decimal` (bukan Float) | Float precision error pada finansial |
| Opening balance | Dicatat sebagai transaksi `income`, category "Saldo Awal" | Ledger bisa direkonstruksi murni dari transaksi |
| Formula saldo | Murni agregat transaksi, tanpa `initialBalance` | Konsisten, tidak ada dual-source |
| Soft-delete akun | Hanya boleh kalau `currentBalance === 0` | Cegah net worth anjlok tanpa jejak |
| Cross-currency transfer | Block 400 kalau `fromCurrency !== toCurrency` | Cegah konversi 1:1 yang merusak data |
| Groq account ref | Alias numerik (1, 2, 3) → map ke UUID di backend | Cegah LLM halusinasi UUID panjang |
| Liability transfer label | "Catat Pembayaran" kalau target akun = liability | Lebih intuitif untuk awam |
| Transfer PATCH | `updateMany where { transferId }` | Update atomic kedua row sekaligus |
| Delete account type | Soft/hard berdasarkan usage count | Proteksi referential integrity |
| Google Sheets | Feature-frozen untuk fitur akun, tampil banner | Avoid dual-source complexity |

---

## Phase 1: Database

### File: `prisma/schema.prisma`

**Model `AccountType`:**

```prisma
model AccountType {
  id             String   @id @default(uuid())
  userId         String   @map("user_id")
  name           String
  classification String                          // "asset" | "liability"
  icon           String   @default("wallet")
  color          String   @default("#6366f1")
  sortOrder      Int      @default(0) @map("sort_order")
  isActive       Boolean  @default(true) @map("is_active")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accounts Account[]

  @@unique([userId, name])
  @@index([userId, isActive])
  @@map("account_types")
}
```

> **Kartu Kredit Extension:** Untuk account type "Kartu Kredit" (classification: liability), perlu field khusus di Account:
> - `tanggalSettlement`: Tanggal settlement billing cycle (1-31). Perioda berjalan dari tanggal (settlement-1) bulan sebelumnya hingga tanggal settlement bulan berjalan. Tanggal settlement dihitung pada perioda selanjutnya.
> - `tanggalJatuhTempo`: Tanggal jatuh tempo pembayaran (1-31). Batas maksimal pembayaran tagihan selama 1 perioda berjalan setelah tanggal settlement.
> 
> Contoh: tanggalSettlement = 17, tanggalJatuhTempo = 5
> - Perioda 1: 16 Des 2025 - 17 Jan 2026 → jatuh tempo 5 Feb 2026
> - Perioda 2: 17 Jan - 16 Feb 2026 → jatuh tempo 5 Mar 2026

**Model `Account`:**

```prisma
model Account {
  id            String   @id @default(uuid())
  userId        String   @map("user_id")
  accountTypeId String   @map("account_type_id")
  name          String
  // initialBalance hanya metadata display, BUKAN masuk kalkulasi saldo
  // saldo awal dicatat via transaksi income "Saldo Awal" saat create
  initialBalance Decimal @default(0) @db.Decimal(19, 4) @map("initial_balance")
  currency      String   @default("IDR")
  color         String?
  icon          String?
  note          String   @default("")
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  // === Kartu Kredit Fields ===
  // Hanya applicable kalau accountType.name = "Kartu Kredit"
  tanggalSettlement   Int?  @map("tanggal_settlement")  // 1-31
  tanggalJatuhTempo   Int?  @map("tanggal_jatuh_tempo") // 1-31

  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  accountType  AccountType   @relation(fields: [accountTypeId], references: [id], onDelete: Restrict)
  transactions Transaction[]

  @@index([userId, isActive])
  @@index([accountTypeId])
  @@map("accounts")
}
```

**Modifikasi `Transaction`:**

```prisma
model Transaction {
  // ...existing fields...
  amount            Decimal  @db.Decimal(19, 4)
  type              String   // "expense" | "income" | "transfer_out" | "transfer_in"
  accountId         String?  @map("account_id")
  transferId        String?  @map("transfer_id")
  isInitialBalance  Boolean  @default(false) @map("is_initial_balance")
  // Flag khusus untuk transaksi "Saldo Awal" — tidak bisa dihapus via UI normal

  account Account? @relation(fields: [accountId], references: [id], onDelete: SetNull)

  @@index([userId, accountId])
  @@index([userId, date])
  @@index([transferId])
}
```

> Pakai `Decimal(19, 4)`: 19 digit total, 4 desimal. Cukup untuk IDR (tidak butuh desimal) maupun USD/BTC. Prisma menyimpannya sebagai string di JS-land, pakai `new Decimal(value)` dari library `decimal.js` untuk aritmatika.

**User model:**

```prisma
accountTypes AccountType[]
accounts     Account[]
```

**Setelah edit:**
```bash
npx prisma db push
npx prisma generate
```

---

## Phase 2: Balance Logic + Seeding

### Arsitektur saldo: murni berbasis transaksi

Saldo akun dihitung 100% dari transaksi. `initialBalance` di tabel Account adalah metadata display saja (berapa yang user input saat setup), tidak masuk rumus.

**Alasan:** Semua perubahan saldo ada di tabel `Transaction`, ledger bisa direkonstruksi kapan saja tanpa melihat tabel Account. Kalau `initialBalance` ikut dihitung, setiap query harus join dua sumber.

**Saat akun dibuat dengan `initialBalance > 0`:**

```typescript
// Di POST /api/accounts handler, setelah prisma.account.create()
if (initialBalance > 0) {
  await prisma.transaction.create({
    data: {
      userId,
      accountId: account.id,
      type: "income",
      amount: new Decimal(initialBalance),
      category: "Saldo Awal",
      date: new Date(),
      note: `Saldo awal akun ${account.name}`,
      isInitialBalance: true,
    },
  });
}
```

**Rumus saldo (murni transaksi):**

```
balance =
  + Σ income transactions WHERE accountId = this.id
  + Σ transfer_in transactions WHERE accountId = this.id
  - Σ expense transactions WHERE accountId = this.id
  - Σ transfer_out transactions WHERE accountId = this.id
```

Transaksi "Saldo Awal" masuk kategori `income`, jadi ikut rumus ini secara natural.

### File: `utils/account-balance.ts`

```typescript
import { Decimal } from "@prisma/client/runtime/library";

export type AccountWithBalance = Account & {
  accountType: AccountType;
  currentBalance: Decimal;
  transactionCount: number;
};

export async function getAccountBalances(userId: string): Promise<AccountWithBalance[]> {
  const accounts = await prisma.account.findMany({
    where: { userId, isActive: true },
    include: { accountType: true },
    orderBy: [
      { accountType: { sortOrder: "asc" } },
      { createdAt: "asc" },
    ],
  });

  const aggregates = await prisma.transaction.groupBy({
    by: ["accountId", "type"],
    where: { userId, accountId: { not: null } },
    _sum: { amount: true },
    _count: true,
  });

  return accounts.map((acc) => {
    let balance = new Decimal(0);
    let count = 0;

    for (const agg of aggregates) {
      if (agg.accountId !== acc.id) continue;
      const sum = new Decimal(agg._sum.amount ?? 0);
      count += agg._count;

      if (agg.type === "income" || agg.type === "transfer_in") {
        balance = balance.plus(sum);
      } else if (agg.type === "expense" || agg.type === "transfer_out") {
        balance = balance.minus(sum);
      }
    }

    return { ...acc, currentBalance: balance, transactionCount: count };
  });
}

export function calculateNetWorth(accounts: AccountWithBalance[]): {
  assets: Decimal;
  liabilities: Decimal;
  netWorth: Decimal;
} {
  let assets = new Decimal(0);
  let liabilities = new Decimal(0);

  for (const acc of accounts) {
    if (acc.accountType.classification === "liability") {
      liabilities = liabilities.plus(acc.currentBalance);
    } else {
      assets = assets.plus(acc.currentBalance);
    }
  }

  return { assets, liabilities, netWorth: assets.minus(liabilities) };
}
```

### File: `utils/account-types.ts`

```typescript
const DEFAULT_TYPES = [
  { name: "Kas",       classification: "asset",     icon: "wallet",         color: "#10b981", sortOrder: 10 },
  { name: "Bank",      classification: "asset",     icon: "landmark",       color: "#3b82f6", sortOrder: 20 },
  { name: "E-Wallet",  classification: "asset",     icon: "smartphone",     color: "#8b5cf6", sortOrder: 30 },
  { name: "Investasi", classification: "asset",     icon: "trending-up",    color: "#f59e0b", sortOrder: 40 },
  { name: "Kripto",    classification: "asset",     icon: "bitcoin",        color: "#f97316", sortOrder: 50 },
  { name: "Properti",  classification: "asset",     icon: "home",           color: "#14b8a6", sortOrder: 60 },
  { name: "Kendaraan", classification: "asset",     icon: "car",            color: "#06b6d4", sortOrder: 70 },
  { name: "Piutang",   classification: "asset",     icon: "handshake",      color: "#84cc16", sortOrder: 80 },
  { name: "Hutang",    classification: "liability", icon: "credit-card",    color: "#ef4444", sortOrder: 90 },
  { name: "Kartu Kredit", classification: "liability", icon: "credit-card", color: "#dc2626", sortOrder: 95 },
  { name: "Lainnya",   classification: "asset",     icon: "more-horizontal",color: "#6b7280", sortOrder: 100 },
];
```

export async function ensureDefaultAccountTypes(userId: string): Promise<void> {
  const existing = await prisma.accountType.count({ where: { userId } });
  if (existing > 0) return;
  await prisma.accountType.createMany({
    data: DEFAULT_TYPES.map((t) => ({ ...t, userId })),
  });
}

export async function ensureDefaultAccount(userId: string): Promise<Account> {
  await ensureDefaultAccountTypes(userId);
  const existing = await prisma.account.findFirst({ where: { userId, isActive: true } });
  if (existing) return existing;

  const kasType = await prisma.accountType.findFirst({ where: { userId, name: "Kas" } });
  return prisma.account.create({
    data: { userId, accountTypeId: kasType!.id, name: "Kas Utama" },
  });
}
```

---

## Phase 3: API Layer

### `app/api/account-types/route.ts` (NEW)

**GET**: List AccountType active milik user, sorted by `sortOrder`.

```typescript
// Response
{ accountTypes: AccountType[] }
```

**POST**: Buat type baru. Validasi:
- `name` non-empty, max 30 char
- `classification` ∈ `["asset", "liability"]`
- Unique per user (dari DB constraint) → tangkap error P2002 → return 409

### `app/api/account-types/[typeId]/route.ts` (NEW)

**PATCH**: Update `name`, `icon`, `color`, `sortOrder`.

> `classification` di-lock jika type sudah punya Account aktif. Return 409:
> `"Tipe ini dipakai N akun aktif. Buat tipe baru untuk klasifikasi berbeda."`
>
> Kalau tidak ada akun aktif (termasuk isActive=false), classification bebas diubah.

**DELETE**:
- Hitung `accountCount` (total, termasuk isActive=false).
- `accountCount > 0` → return 409: `"Pindahkan atau hapus semua akun bertipe ini terlebih dahulu."`
- `accountCount === 0` → hard-delete (no soft-delete untuk type tanpa akun).
- Kalau masih punya akun aktif tapi user mau "arsipkan" → soft-delete type (`isActive=false`). Type hilang dari dropdown tapi akun tetap aktif.

### `app/api/accounts/route.ts` (NEW)

**GET**: Return akun active dengan `currentBalance` + summary.

```typescript
// Response
{
  accounts: AccountWithBalance[],
  summary: { assets: string, liabilities: string, netWorth: string }
  // Decimal di-serialize ke string untuk JSON safety
}
```

**POST**: Buat akun. Handler:

```typescript
// Validasi accountTypeId milik user
// Parse dan validasi initialBalance sebagai Decimal
// Validasi Kartu Kredit: kalau type.name === "Kartu Kredit", wajib ada tanggalSettlement & tanggalJatuhTempo
// Create account
// Kalau initialBalance > 0, insert transaksi "Saldo Awal" (isInitialBalance: true)
```

### `app/api/accounts/[accountId]/route.ts` (NEW)

**PATCH**: Update `accountTypeId`, `name`, `color`, `icon`, `note`, `tanggalSettlement`, `tanggalJatuhTempo`.

> `initialBalance` tidak bisa di-PATCH — pakai `/adjust`.
> `currency` tidak bisa di-PATCH kalau sudah ada transaksi.
> Untuk Kartu Kredit: tanggalSettlement dan tanggalJatuhTempo bisa di-PATCH.

**DELETE**: Soft-delete `isActive=false`.

> **Guard wajib:** Hitung `currentBalance` sebelum delete. Kalau `currentBalance !== 0`, return 400:
> `"Saldo akun ini masih Rp X. Transfer atau sesuaikan saldo ke 0 sebelum mengarsipkan."`
>
> Ini mencegah net worth anjlok diam-diam ketika akun bersaldo diarsipkan.

Hard-delete via `?hard=true` hanya kalau `transactionCount === 0`.

### `app/api/accounts/[accountId]/adjust/route.ts` (NEW)

**POST**: Koreksi saldo. Body: `{ targetBalance: number, note?: string }`.

```typescript
const current = await getCurrentBalance(accountId); // dari getAccountBalances
const diff = new Decimal(targetBalance).minus(current);

if (diff.isZero()) return { message: "Saldo sudah sesuai." };

await prisma.transaction.create({
  data: {
    userId,
    accountId,
    type: diff.isPositive() ? "income" : "expense",
    amount: diff.abs(),
    category: "Penyesuaian Saldo",
    date: new Date(),
    note: note ?? "Koreksi saldo manual",
    isInitialBalance: false,
  },
});
```

### `app/api/transactions/manual/route.ts` (NEW)

Endpoint manual, bypass AI.

**Guard cross-currency untuk transfer:**

```typescript
if (payload.type === "transfer") {
  const [fromAcc, toAcc] = await prisma.$transaction([
    prisma.account.findFirst({ where: { id: fromAccountId, userId } }),
    prisma.account.findFirst({ where: { id: toAccountId, userId } }),
  ]);

  if (!fromAcc || !toAcc) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });

  if (fromAccountId === toAccountId)
    return NextResponse.json({ error: "Akun asal dan tujuan tidak boleh sama." }, { status: 400 });

  if (fromAcc.currency !== toAcc.currency)
    return NextResponse.json(
      { error: `Transfer beda mata uang belum didukung (${fromAcc.currency} → ${toAcc.currency}). Catat sebagai expense dan income terpisah.` },
      { status: 400 }
    );

  // Insert double-entry
  const transferId = randomUUID();
  await prisma.$transaction([
    prisma.transaction.create({ data: {
      userId, type: "transfer_out", amount: new Decimal(payload.amount),
      accountId: fromAccountId, transferId, category: "Transfer", date: payload.date, note: payload.note
    }}),
    prisma.transaction.create({ data: {
      userId, type: "transfer_in", amount: new Decimal(payload.amount),
      accountId: toAccountId, transferId, category: "Transfer", date: payload.date, note: payload.note
    }}),
  ]);
}
```

### Modifikasi `app/api/record/[recordId]/route.ts`

**PATCH transfer:**

```typescript
if (existingTx.transferId) {
  // Update kedua row sekaligus
  await prisma.transaction.updateMany({
    where: { transferId: existingTx.transferId },
    data: { amount: new Decimal(newAmount), note: newNote, date: newDate },
  });
}
```

**DELETE transfer:**

```typescript
if (existingTx.transferId) {
  await prisma.transaction.deleteMany({ where: { transferId: existingTx.transferId } });
}
```

**Guard: transaksi `isInitialBalance = true` tidak bisa di-delete atau di-edit amount-nya via UI normal:**

```typescript
if (existingTx.isInitialBalance && (newAmount !== undefined)) {
  return NextResponse.json({ error: "Gunakan fitur 'Sesuaikan Saldo' untuk mengubah saldo awal." }, { status: 403 });
}
```

---

## Phase 4: Halaman Tipe Akun

### `app/dashboard/settings/account-types/page.tsx` (NEW)

```
[Header] Tipe Akun                           [+ Tambah Tipe]

[Info banner]
  Tipe akun mengelompokkan akun dan menentukan apakah masuk
  hitungan aset atau liability di net worth.

[List drag-reorder, grouped by classification]

  ━━━ ASET ━━━
  ⠿  [icon] Kas              [Edit] [Hapus]
  ⠿  [icon] Bank             [Edit] [Hapus]
  ⠿  [icon] Reksadana Dana   [Edit] [Hapus]  (custom)
  ...

  ━━━ LIABILITY ━━━
  ⠿  [icon] Hutang           [Edit] [Hapus]
  ⠿  [icon] Cicilan Motor    [Edit] [Hapus]  (custom)
```

Drag-reorder → batch PATCH `sortOrder`.

### `components/AccountTypeFormModal.tsx` (NEW)

Fields:
- Nama (text, required, unique check realtime via debounce)
- Classification (radio: Aset / Liability, disabled on edit kalau punya akun aktif)
- Icon (preset lucide icons)
- Warna (preset 12 hex)

Helper text classification:
> **Aset**: menambah net worth (kas, bank, investasi, piutang).
> **Liability**: mengurangi net worth (hutang, cicilan, kartu kredit).
> 
> **Kartu Kredit**: Tipe liability khusus dengan tracking perioda billing. Wajib input `tanggalSettlement` dan `tanggalJatuhTempo` saat membuat akun. Gunakan tipe "Hutang" untuk utang non-Kartu Kredit (kredit motor, KPR, dll).

---

## Phase 5: Halaman Akun

### `app/dashboard/accounts/page.tsx` (NEW)

```
[Header] Akun & Dompet                          [+ Tambah Akun]

[Net Worth Hero]
  Total Aset           Net Worth                 Total Liability
  Rp 12.500.000        Rp 10.200.000             Rp 2.300.000

[Daftar Akun, grouped by AccountType.name, sort by sortOrder]

[Arsip Akun] (collapsible, isActive=false)

[Link] Kelola tipe akun →
```

### `components/AccountCard.tsx` (NEW)

Actions menu:
- Edit
- Sesuaikan Saldo
- Pindah tipe akun (ganti accountTypeId)
- Arsipkan (disabled + tooltip kalau `currentBalance !== 0`)
- Hapus permanen (disabled kalau `transactionCount > 0`)

### `components/AccountFormModal.tsx` (NEW)

Fields:
- Nama (required)
- Tipe Akun (dropdown accountTypes aktif, required. Bottom option: `+ Tambah tipe baru` → buka AccountTypeFormModal)
- Saldo Awal (number, required on create, disabled on edit kalau ada transaksi non-initial)
- Currency (IDR | USD)
- Warna / Icon (optional, null = inherit type)
- Catatan

**Kartu Kredit Fields** (muncul kalau `accountType.name === "Kartu Kredit"`):
- Tanggal Settlement (number 1-31, required)
- Tanggal Jatuh Tempo (number 1-31, required)

> Validasi: tanggalJatuhTempo harus berbeda dari tanggalSettlement (bisa lebih kecil karena lintas bulan). Contoh: settlement 17, jatuh tempo 5 (bulan berikutnya).

### `components/NetWorthSummaryCard.tsx` (NEW)

Self-fetch `GET /api/accounts`. Net worth besar + breakdown. Link ke `/dashboard/accounts`.

---

## Phase 8: Laporan Arus Kas Berbasis Kartu Kredit

### Konsep Perioda Kartu Kredit

Setiap akun Kartu Kredit memiliki billing cycle berdasarkan `tanggalSettlement` dan `tanggalJatuhTempo`:

```
Perioda N:
- Mulai: tanggalSettlement - 1 bulan sebelumnya (jam 00:00)
- Akhir: tanggalSettlement bulan berjalan (jam 23:59)
- Jatuh Tempo: tanggalJatuhTempo bulan berikutnya

Contoh: tanggalSettlement=17, tanggalJatuhTempo=5
- Perioda Des 2025 - Jan 2026: 16 Des 2025 00:00 s/d 17 Jan 2026 23:59
  → Jatuh Tempo: 5 Feb 2026
- Perioda Jan 2026 - Feb 2026: 17 Jan 2026 00:00 s/d 16 Feb 2026 23:59
  → Jatuh Tempo: 5 Mar 2026
```

### API: `/api/cashflow/route.ts` (NEW)

**GET**: Query params: `month`, `year`

```typescript
// Response
{
  period: {
    start: Date,
    end: Date,
    dueDate: Date,
    settlementDate: number
  },
  creditCards: [
    {
      accountId: string,
      accountName: string,
      totalSpend: Decimal,      // Σ expense di perioda ini
      totalPayment: Decimal,    // Σ transfer_in (pembayaran) di perioda ini
      outstanding: Decimal,     // totalSpend - totalPayment
      isOverdue: boolean        // sekarang > dueDate && outstanding > 0
    }
  ],
  summary: {
    totalSpend: Decimal,
    totalPayment: Decimal,
    totalOutstanding: Decimal,
    overdueCount: number
  }
}
```

**Logic:**

```typescript
function getCreditCardPeriod(settlementDate: number, targetMonth: number, targetYear: number) {
  // Perioda bulan ini: mulai dari (settlement-1) bulan sebelumnya
  const start = new Date(targetYear, targetMonth - 1, settlementDate);
  if (settlementDate === 1) {
    start.setMonth(start.getMonth() - 1); // edge case
  }
  start.setDate(start.getDate() - 1); // mundur 1 hari
  
  // Akhir: settlement date bulan berjalan
  const end = new Date(targetYear, targetMonth - 1, settlementDate);
  end.setHours(23, 59, 59, 999);
  
  // Jatuh tempo: tanggalJatuhTempo bulan berikutnya
  const dueDate = new Date(targetYear, targetMonth, tanggalJatuhTempo);
  
  return { start, end, dueDate };
}
```

### Halaman Laporan Arus Kas

**`app/dashboard/cashflow/page.tsx` (NEW)**

```
[Header] Laporan Arus Kas          [< Bulan Ini >]

[Summary Cards]
  Total Pengeluaran    Total Pembayaran    Outstanding    Terlambat
  Rp 15.000.000        Rp 12.000.000       Rp 3.000.000   1 Kartu

[Detail per Kartu Kredit]
  ┌─────────────────────────────────────────────────────────┐
  │ BCA Visa              │ Perioda: 16 Des - 17 Jan       │
  │ Jatuh Tempo: 5 Feb    │ Status: ✓ Lunas                │
  │ Pengeluaran: Rp 8jt   │ Pembayaran: Rp 8jt             │
  └─────────────────────────────────────────────────────────┘
  
  ┌─────────────────────────────────────────────────────────┐
  │ Mandiri Gold          │ Perioda: 16 Des - 17 Jan       │
  │ Jatuh Tempo: 5 Feb    │ Status: ⚠ Outstanding         │
  │ Pengeluaran: Rp 7jt   │ Pembayaran: Rp 4jt             │
  │ Outstanding: Rp 3jt   │ [Btn: Bayar Sekarang]          │
  └─────────────────────────────────────────────────────────┘
```

### Cash Flow Projection (Opsional)

Hitung proyeksi arus kas 30/60/90 hari ke depan dengan mempertimbangkan:
- Tanggal jatuh tempo Kartu Kredit
- Recurring transactions (kalau ada di v1.5+)

---

## Phase 6: Manual Input Form

### `components/ManualTransactionForm.tsx` (NEW)

**Empty state**: CTA ke `/dashboard/accounts` kalau `accounts.length === 0`.

**Dropdown akun**: grouped by type dengan `<optgroup>`.

**Tab Transfer:**

- Guard currency: kalau user pilih dua akun beda currency, tampil inline warning sebelum submit:
  > `"Transfer beda mata uang tidak didukung. Catat sebagai pengeluaran dan pemasukan terpisah."`
  Submit button di-disable.

- **Label dinamis berdasarkan target akun:**

```typescript
const toAccType = accounts.find(a => a.id === toAccountId)?.accountType;
const isLiabilityTarget = toAccType?.classification === "liability";

// Label di button submit dan form title
const submitLabel = isLiabilityTarget ? "Catat Pembayaran Cicilan/Hutang" : "Transfer";
const helperText = isLiabilityTarget
  ? "Uang keluar dari akun asal, saldo hutang/cicilan berkurang."
  : "Pindahkan saldo antar akun. Net worth tidak berubah.";
```

Ini kasih konteks kognitif yang tepat: user yang bayar KPR dari BCA nggak perlu mikir "kenapa saya transfer ke KPR".

---

## Phase 7: Sidebar + Settings

### `components/Sidebar.tsx`

```typescript
{ name: "Akun & Dompet", href: "/dashboard/accounts", icon: Wallet }
{ name: "Arus Kas", href: "/dashboard/cashflow", icon: TrendingDown }  // Kartu Kredit focused
// Di Settings group:
{ name: "Tipe Akun", href: "/dashboard/settings/account-types", icon: Tags }
```

---

## Phase 8: Groq Integration (opsional v1)

### Alias mapping, bukan UUID

Inject context dengan alias numerik:

```typescript
const accountContext = accounts
  .map((a, i) => `${i + 1}: "${a.name}" (${a.accountType.name})`)
  .join("\n");

const aliasMap = Object.fromEntries(accounts.map((a, i) => [String(i + 1), a.id]));
// Simpan aliasMap untuk mapping response Groq ke UUID asli
```

SYSTEM_PROMPT:

```
Akun user (pakai nomor saat return, bukan UUID):
1: "Kas Utama" (Kas)
2: "BCA Tabungan" (Bank)
3: "OVO" (E-Wallet)

Rules:
- Return nomor alias, bukan teks nama akun atau UUID.
- Kalau user sebut "BCA", return accountId: 2.
- Kalau ambigu, return null.
- Format transfer: {"intent":"transfer","amount":N,"fromAccountId":2,"toAccountId":3,"date":"YYYY-MM-DD"}
```

Backend handler:

```typescript
const resolvedFromId = aliasMap[String(parsed.fromAccountId)] ?? null;
const resolvedToId   = aliasMap[String(parsed.toAccountId)]   ?? null;
```

Ini jauh lebih akurat daripada LLM harus regenerate UUID panjang per response.

---

## Files Summary

| File | Status | Keterangan |
|------|--------|------------|
| `prisma/schema.prisma` | **Modify** | Decimal, isInitialBalance, AccountType, tanggalSettlement, tanggalJatuhTempo |
| `utils/account-balance.ts` | **New** | Decimal-safe balance + net worth |
| `utils/account-types.ts` | **New** | Seed defaults + ensureDefaultAccount + Kartu Kredit type |
| `app/api/account-types/route.ts` | **New** | GET + POST |
| `app/api/account-types/[typeId]/route.ts` | **New** | PATCH (lock classification) + DELETE |
| `app/api/accounts/route.ts` | **New** | GET + POST (auto-insert transaksi saldo awal + validasi CC) |
| `app/api/accounts/[accountId]/route.ts` | **New** | PATCH + DELETE (guard currentBalance=0) |
| `app/api/accounts/[accountId]/adjust/route.ts` | **New** | Koreksi saldo via Decimal diff |
| `app/api/transactions/manual/route.ts` | **New** | Manual input + cross-currency guard |
| `app/api/record/route.ts` | **Modify** | Groq alias context, transfer handler |
| `app/api/record/[recordId]/route.ts` | **Modify** | Atomic edit/delete transfer pair, guard isInitialBalance |
| `app/api/cashflow/route.ts` | **New** | Laporan arus kas Kartu Kredit per perioda |
| `components/AccountTypeFormModal.tsx` | **New** | CRUD type + classification helper text |
| `components/AccountFormModal.tsx` | **New** | CRUD akun + shortcut tambah type + CC fields |
| `components/AccountCard.tsx` | **New** | Card + actions + disabled guard |
| `components/ManualTransactionForm.tsx` | **New** | 3-tab + currency guard + liability label |
| `components/NetWorthSummaryCard.tsx` | **New** | Net worth hero |
| `app/dashboard/accounts/page.tsx` | **New** | Halaman akun |
| `app/dashboard/settings/account-types/page.tsx` | **New** | Kelola tipe + drag-reorder |
| `app/dashboard/cashflow/page.tsx` | **New** | Laporan arus kas Kartu Kredit |
| `app/dashboard/page.tsx` | **Modify** | +NetWorthSummaryCard, +form manual |
| `components/Sidebar.tsx` | **Modify** | +nav akun + arus kas + settings tipe |
| `utils/groq.ts` | **Modify** | Alias mapping, intent transfer |

---

## Urutan Implementasi

1. Schema → `prisma db push` → `prisma generate` (dengan tanggalSettlement, tanggalJatuhTempo)
2. `utils/account-types.ts` (seed defaults + ensureDefaultAccount + Kartu Kredit)
3. `utils/account-balance.ts` (Decimal-safe)
4. API account-types (CRUD)
5. API accounts (GET/POST + auto saldo awal tx + guard delete + validasi CC)
6. API accounts adjust
7. `AccountTypeFormModal` + `/settings/account-types` page
8. `AccountFormModal` + `AccountCard` (dengan field CC)
9. `/dashboard/accounts` page + `NetWorthSummaryCard`
10. Sidebar nav + settings link + arus kas
11. `app/api/transactions/manual` + cross-currency guard
12. `ManualTransactionForm` + integrasi dashboard
13. Modifikasi record routes (atomic pair, isInitialBalance guard)
14. Groq alias mapping + transfer intent
15. **Phase 8: Cash Flow** - API `/api/cashflow` + halaman `/dashboard/cashflow`
16. Sheets mode banner

---

## Verification Checklist

### Schema
- [ ] `prisma db push` sukses
- [ ] Field `amount`, `initialBalance` bertipe Decimal di DB (`DECIMAL(19,4)`)
- [ ] Field `isInitialBalance` ada di transaksi, default false
- [ ] Index terbuat: `[userId, accountId]`, `[userId, date]`, `[transferId]`

### Saldo Awal
- [ ] Buat akun "BCA" dengan saldo awal Rp 5jt → ada transaksi income "Saldo Awal" Rp 5jt di histori
- [ ] `getAccountBalances` return `currentBalance = 5.000.000` (dari transaksi, bukan field statis)
- [ ] Transaksi "Saldo Awal" tidak bisa dihapus via UI normal
- [ ] Transaksi "Saldo Awal" tidak bisa diubah amount-nya via UI normal → arahkan ke `/adjust`
- [ ] Buat akun tanpa saldo awal → tidak ada transaksi "Saldo Awal"

### AccountType CRUD
- [ ] Seed 10 default types saat user pertama kali
- [ ] POST type baru "Reksadana Syariah" (asset) → muncul di dropdown
- [ ] PATCH classification type yang sudah punya akun aktif → 409
- [ ] PATCH classification type tanpa akun aktif → sukses
- [ ] DELETE type dengan akun → 409 hard, soft-delete tersedia
- [ ] DELETE type tanpa akun → hard-delete sukses
- [ ] Nama duplicate → 409

### Account CRUD
- [ ] POST akun → accountType fetch ikut response
- [ ] PATCH ganti accountTypeId → akun pindah group di UI
- [ ] DELETE akun `currentBalance !== 0` → 400 dengan pesan saldo
- [ ] DELETE akun `currentBalance === 0` → soft-delete sukses, transaksi tetap ada

### Transfer
- [ ] Transfer IDR → IDR: 2 row `transfer_out` + `transfer_in`, `transferId` sama
- [ ] Transfer IDR → USD: return 400 cross-currency error
- [ ] Transfer akun ke diri sendiri: return 400
- [ ] PATCH amount transfer → kedua row ter-update
- [ ] DELETE 1 row transfer → kedua row terhapus

### Net Worth Invariant
- [ ] Sebelum transfer = sesudah transfer (Decimal equality):
  ```typescript
  const before = calculateNetWorth(await getAccountBalances(userId));
  // ...execute transfer...
  const after = calculateNetWorth(await getAccountBalances(userId));
  assert(before.netWorth.equals(after.netWorth));
  ```
- [ ] Liability account saldo 5jt, aset 10jt → net worth = 5jt
- [ ] Arsip akun bersaldo nol → net worth tidak berubah

### UX Guard
- [ ] Arsipkan button disabled + tooltip kalau saldo akun != 0
- [ ] Form transfer pilih akun beda currency → warning inline, submit disabled
- [ ] Transfer ke liability account → label berubah ke "Catat Pembayaran Cicilan/Hutang"
- [ ] Transfer form dropdown "Ke Akun" exclude akun di "Dari Akun"
- [ ] Dropdown akun pakai optgroup per type name
- [ ] Empty state form manual kalau belum ada akun

### Groq
- [ ] Context inject alias 1,2,3 bukan UUID
- [ ] Groq return alias → backend resolve ke UUID yang benar
- [ ] Transfer dengan alias null → fallback error ke UI

### Kartu Kredit
- [ ] POST akun "Kartu Kredit BCA" tanpa tanggalSettlement/tanggalJatuhTempo → 400
- [ ] POST akun "Kartu Kredit BCA" dengan tanggalSettlement=17, tanggalJatuhTempo=5 → sukses
- [ ] GET /api/accounts → return field tanggalSettlement & tanggalJatuhTempo
- [ ] PATCH akun CC ganti tanggalSettlement → sukses
- [ ] Tanggal settlement 1 edge case: perioda mulai dari hari terakhir bulan sebelumnya

### Laporan Arus Kas
- [ ] GET /api/cashflow?month=1&2026 → return perioda yang benar (16 Des - 17 Jan)
- [ ] Pengeluaran di perioda terhitung dengan benar (expense di rentang tanggal)
- [ ] Pembayaran di perioda terhitung dengan benar (transfer_in di rentang tanggal)
- [ ] Outstanding = totalSpend - totalPayment
- [ ] Status overdue: sekarang > dueDate && outstanding > 0
- [ ] Halaman /dashboard/cashflow menampilkan semua Kartu Kredit dengan benar

### Sheets Mode
- [ ] Banner muncul di `/dashboard/accounts` dan `/settings/account-types`

---

## Migration Notes (User Existing)

1. Transaksi lama `accountId = null` tetap muncul normal, tidak error.
2. Field `initialBalance` di existing account rows (kalau ada dari schema sebelumnya) → tidak dipakai kalkulasi, hanya metadata.
3. Saat pertama akses post-deploy:
   - Seed 10 default types
   - Auto-create "Kas Utama"
   - Banner opsional: "Mau kaitkan transaksi lama ke Kas Utama?" → bulk update `WHERE accountId IS NULL`.
4. Tidak ada data loss. Semua transaksi lama tetap valid.

---

## Scope Parkir v1.5+

- Cross-currency transfer dengan FX rate input manual
- SavingsGoal earmarked dalam Account
- Recurring transactions
- Budget per akun
- Shared account antar user
- Import CSV statement bank
- AccountType community templates