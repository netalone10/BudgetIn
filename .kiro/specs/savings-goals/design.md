# Design Document: Savings Goals & Cashflow Hybrid

## Overview

Fitur ini menambahkan dua kapabilitas utama ke aplikasi BudgetIn:

1. **Savings Goals** — Halaman `/dashboard/savings` untuk membuat dan memantau target tabungan. Kontribusi dideteksi otomatis dari transaksi berkategori "tabungan"/"nabung".
2. **Cashflow Hybrid** — Savings diperlakukan sebagai *alokasi* tersendiri, bukan expense. Formula cashflow menjadi: `Income − Expenses − Savings = Sisa`. Dashboard summary diperbarui untuk mencerminkan formula ini.

Selain itu, ada perbaikan kecil: kolom "Budget" di Budget_Table menampilkan nominal penuh (bukan format singkat).

### Konsep Cashflow Hybrid

Savings bukan expense — secara konseptual uang itu tidak "habis", melainkan dialokasikan. Dengan memisahkan savings dari expense di cashflow view, user mendapat gambaran yang lebih akurat:

```
Income:    10.000.000
- Expenses: 6.500.000
- Savings:  2.000.000
= Sisa:     1.500.000
```

Ini juga membuka jalan untuk AI insight di masa depan: *"Lo berhasil saving 20% dari income bulan ini, di atas rata-rata rekomendasi 10–15%."*

---

## Architecture

### Komponen Baru

```
app/
  dashboard/
    savings/
      page.tsx              ← Halaman Savings Goals

app/api/
  savings/
    route.ts                ← GET (list goals) + POST (create goal)
    [goalId]/
      route.ts              ← DELETE goal

components/
  SavingsGoalCard.tsx       ← Card per goal: progress bar + history expand/collapse
```

### Komponen yang Dimodifikasi

```
components/
  Sidebar.tsx               ← Tambah nav item "Tabungan"
  DashboardTabs.tsx         ← Update cashflow summary: hybrid formula + savings row

prisma/
  schema.prisma             ← Tambah model SavingsGoal
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Savings Page                            │
│                                                             │
│  GET /api/savings ──► SavingsGoal[] + contributions[]       │
│  POST /api/savings ──► create new goal                      │
│  DELETE /api/savings/[goalId] ──► delete goal               │
│         (WAJIB: where: { id: goalId, userId: session.userId })│
│                                                             │
│  Contributions diambil dari:                                │
│    DB User  → prisma.transaction (category ILIKE %nabung%)  │
│             + kategori dengan isSavings = true              │
│    GSheets  → getTransactions() → filter keyword            │
│             (GSheets tidak support isSavings flag)          │
│                                                             │
│  Catatan performa GSheets:                                  │
│    getTransactions() melakukan HTTP call ke Google API      │
│    dengan latency ~200-800ms. Hindari multiple calls        │
│    dalam satu request — fetch sekali, filter di memory.     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  Cashflow Hybrid (DashboardTabs)             │
│                                                             │
│  totalSavings = sum(transactions where isSavings(category)) │
│  totalExpense = sum(expense txs) - totalSavings             │
│  sisa = totalIncome - totalExpense - totalSavings           │
└─────────────────────────────────────────────────────────────┘
```

---

## Components and Interfaces

### 1. `SavingsGoalCard`

```tsx
interface SavingsGoalCardProps {
  goal: SavingsGoalWithProgress;
  onDelete: (goalId: string) => void;
}

interface SavingsGoalWithProgress {
  id: string;
  name: string;
  targetAmount: number;
  deadline?: string | null;   // ISO date string dari DateTime, di-serialize ke string di API response
  createdAt: string;
  totalContributed: number;   // dihitung dari transaksi — tidak di-cap, bisa > targetAmount
  contributions: Contribution[];
}

interface Contribution {
  id: string;
  date: string;
  amount: number;
  note: string;
}
```

Perilaku card:
- Menampilkan nama goal, progress bar, nominal terkumpul / target
- Jika `deadline` ada: tampilkan sisa hari atau badge "Terlambat"
- Jika `totalContributed >= targetAmount`: tampilkan badge "Tercapai" (warna hijau)
- Tombol expand/collapse untuk history kontribusi
- Tombol hapus goal

### 2. API Route `/api/savings`

```ts
// GET — list semua goals + contributions
Response: {
  goals: SavingsGoalWithProgress[]
}

// POST — buat goal baru
Body: { name: string; targetAmount: number; deadline?: string }
Response: { goal: SavingsGoal }
```

### 3. API Route `/api/savings/[goalId]`

```ts
// DELETE — hapus goal
// WAJIB: query harus include userId filter untuk ownership check
// await prisma.savingsGoal.delete({ where: { id: goalId, userId: session.userId } });
// Jika goal tidak ditemukan (atau bukan milik user), Prisma throw P2025 → return 404
Response: { success: true }
```

### 4. Keyword Matcher & User-Configurable Savings Categories

Deteksi savings menggunakan dua mekanisme yang digabungkan (OR logic):

**a) Keyword matching** — keyword list yang luas untuk menangkap variasi bahasa Indonesia:

```ts
const SAVINGS_KEYWORDS = [
  // Tabungan umum
  "tabungan", "nabung", "menabung",
  // Dana khusus
  "dana darurat", "dana pensiun", "dana pendidikan", "dana liburan",
  // Instrumen investasi
  "investasi", "deposito", "reksa dana", "reksadana", "saham",
  // Variasi lain
  "saving", "savings", "simpanan", "celengan",
];

function isSavingsKeyword(category: string): boolean {
  const lower = category.toLowerCase();
  return SAVINGS_KEYWORDS.some((kw) => lower.includes(kw));
}
```

**b) User-configurable savings categories** — user dapat menandai kategori apapun sebagai savings melalui field `isSavings` di model `Category`. Ini memungkinkan user dengan kategori custom (misal: "DANA PENSIUN MANDIRI", "Investasi Crypto") tetap terdeteksi tanpa bergantung pada keyword.

```ts
// Fungsi utama — gabungkan keyword matching + isSavings flag
function isSavingsTransaction(
  category: string,
  savingsCategoryNames: Set<string>
): boolean {
  return isSavingsKeyword(category) || savingsCategoryNames.has(category.toLowerCase());
}
```

`savingsCategoryNames` diisi dari query:
```ts
const savingsCategories = await prisma.category.findMany({
  where: { userId: session.userId, isSavings: true },
  select: { name: true },
});
const savingsCategoryNames = new Set(savingsCategories.map(c => c.name.toLowerCase()));
```

**Catatan untuk Google Sheets users**: Karena Sheets tidak menyimpan metadata `isSavings`, deteksi untuk Google users hanya menggunakan keyword matching. User-configurable categories hanya berlaku untuk DB users.

Fungsi ini digunakan di dua tempat:
- `DashboardTabs.tsx` — untuk memisahkan savings dari expense di cashflow summary
- `app/api/savings/route.ts` — untuk menghitung total kontribusi per goal

### 5. Cashflow Hybrid di `DashboardTabs`

Summary cards diubah dari 3 kolom (Income / Expense / Net) menjadi 4 kolom:

```
┌──────────┬──────────┬──────────┬──────────┐
│ Pemasukan│Pengeluaran│ Tabungan │   Sisa   │
│ +10jt    │  -6.5jt  │  -2jt   │  +1.5jt  │
└──────────┴──────────┴──────────┴──────────┘
```

Formula: `Income − Expenses − Savings = Sisa`

Di section "Pengeluaran" pada cashflow view, transaksi savings **tidak** dimasukkan ke dalam kategori expense — melainkan ditampilkan sebagai section tersendiri "Tabungan/Alokasi".

**Behavior `totalContributed > targetAmount`:**
- Di **card view**: progress bar di-cap 100%, badge "Tercapai" ditampilkan, tapi `totalContributed` tetap menampilkan angka asli (misal: "Rp 2.500.000 / Rp 2.000.000")
- Di **cashflow view**: `totalSavings` tetap menghitung **semua** transaksi savings tanpa cap — karena ini adalah cashflow aktual, bukan progress goal. Ini konsisten: uang yang sudah ditabung tetap keluar dari "sisa" meskipun goal sudah tercapai.
- Behavior ini harus konsisten antara kedua view dan terdokumentasi di komentar kode.

---

## Data Models

### Schema Prisma — Model Baru

```prisma
model SavingsGoal {
  id           String    @id @default(uuid())
  userId       String    @map("user_id")
  name         String
  targetAmount Float     @map("target_amount")
  deadline     DateTime? @map("deadline")   // DateTime? — bukan String, agar sorting & comparison mudah di query level
  createdAt    DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("savings_goals")
}
```

Relasi ke `User` dengan cascade delete — jika user dihapus, semua goals ikut terhapus.

**Catatan desain**: Contributions tidak disimpan sebagai tabel tersendiri. Mereka dihitung secara dinamis dari tabel `transactions` (DB users) atau Google Sheets (Google users) menggunakan Keyword_Matcher. Ini menghindari duplikasi data dan memastikan konsistensi — jika user mengedit/menghapus transaksi, progress goal otomatis terupdate.

### Update `Category` model — tambah field `isSavings`

```prisma
model Category {
  // ... existing fields ...
  isSavings Boolean @default(false) @map("is_savings")
}
```

Field ini memungkinkan user menandai kategori apapun sebagai savings melalui UI Kelola Kategori, tanpa bergantung pada nama/keyword.

### Update `User` model

```prisma
model User {
  // ... existing fields ...
  savingsGoals SavingsGoal[]
}
```

### Tipe TypeScript

```ts
// Dari API response
interface SavingsGoal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  deadline: string | null;  // ISO string dari DateTime, di-serialize ke string di API response
  createdAt: string;
}

interface SavingsGoalWithProgress extends SavingsGoal {
  totalContributed: number;
  contributions: Contribution[];
}

interface Contribution {
  id: string;
  date: string;
  amount: number;
  note: string;
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Keyword Matcher — case-insensitive detection

*For any* transaction category string, `isSavingsKeyword(category)` SHALL return `true` if and only if the lowercased category contains at least one keyword dari `SAVINGS_KEYWORDS` list, regardless of the original casing.

**Validates: Requirements 2.1, 2.2**

### Property 2: Cashflow Hybrid — savings excluded from expense

*For any* list of transactions containing a mix of expense, income, and savings-category transactions, the computed `totalExpense` SHALL equal the sum of only non-savings, non-income transactions; and `totalSavings` SHALL equal the sum of savings-category transactions (no cap applied).

**Validates: Requirements 4.1, 4.3, 4.4**

### Property 3: Cashflow Hybrid — formula invariant

*For any* list of transactions, the following invariant SHALL hold:
`totalIncome − totalExpense − totalSavings = sisa`

**Validates: Requirements 4.1**

### Property 4: Goal creation round-trip

*For any* valid goal (non-empty name, positive targetAmount), creating a goal via POST `/api/savings` and then fetching via GET `/api/savings` SHALL return a list that includes the created goal with identical `name` and `targetAmount`.

**Validates: Requirements 1.2**

### Property 5: Contribution total consistency

*For any* set of transactions where a subset matches the savings keyword or has `isSavings = true`, the `totalContributed` returned by the API SHALL equal the sum of `amount` for all matching transactions — without any cap, even if the sum exceeds `targetAmount`.

**Validates: Requirements 2.5, 3.2**

### Property 6: Goal validation rejects invalid input

*For any* goal creation request where `name` is empty/whitespace-only or `targetAmount` is ≤ 0, the API SHALL reject the request with a 4xx error and not persist any data.

**Validates: Requirements 1.3**

### Property 7: DELETE ownership check

*For any* goal ID, a DELETE request from a user who does not own that goal SHALL NOT delete the goal and SHALL return a non-2xx response.

**Validates: Requirements 5.2, 5.3**

---

## Error Handling

### API Errors

| Skenario | HTTP Status | Response |
|---|---|---|
| Unauthenticated | 401 | `{ error: "Unauthorized" }` |
| Name kosong / targetAmount ≤ 0 | 400 | `{ error: "Nama goal dan target amount wajib diisi" }` |
| Goal tidak ditemukan saat DELETE | 404 | `{ error: "Goal tidak ditemukan" }` |
| DELETE goal milik user lain | 404 | `{ error: "Goal tidak ditemukan" }` (intentionally 404, bukan 403, untuk tidak leak existence) |
| DB error | 500 | `{ error: "Gagal menyimpan. Coba lagi." }` |
| Google Sheets token expired | 401 | `{ error: "Sesi expired. Silakan login ulang." }` |

### UI Error Handling

- Form validation di client-side sebelum submit (nama kosong, amount ≤ 0)
- Error message ditampilkan inline di bawah form
- Jika fetch goals gagal: tampilkan pesan error dengan tombol retry
- Jika delete gagal: tampilkan toast/alert error, goal tidak dihapus dari UI

### Edge Cases

- **Google user token expired**: Tangkap error dari `getValidToken`, return 401 dengan pesan yang jelas
- **Tidak ada transaksi savings**: `totalContributed = 0`, progress bar 0%, tidak ada history
- **Deadline sudah lewat, goal belum tercapai**: Tampilkan badge "Terlambat" (warna merah/oranye)
- **totalContributed > targetAmount**: Progress bar di-cap 100%, badge "Tercapai" tetap muncul

---

## Testing Strategy

### Unit Tests

Fokus pada logika murni yang tidak memerlukan database atau network:

1. **`isSavingsKeyword(category)`** — test berbagai variasi keyword dan casing:
   - `"Tabungan"` → true
   - `"NABUNG"` → true
   - `"dana darurat"` → true
   - `"DANA PENSIUN"` → true
   - `"investasi bulanan"` → true
   - `"deposito BCA"` → true
   - `"makan"` → false
   - `""` → false

2. **`isSavingsTransaction(category, savingsCategoryNames)`** — test kombinasi:
   - Keyword match saja → true
   - `isSavings` flag saja (kategori custom) → true
   - Keduanya → true
   - Tidak ada keduanya → false

3. **Cashflow hybrid calculation** — test formula `Income − Expense − Savings = Sisa`:
   - Mix transaksi income, expense, savings
   - `totalContributed > targetAmount` → savings tetap dihitung penuh (tidak di-cap)
   - Semua savings (expense = 0)

4. **Goal validation** — test edge cases:
   - Nama hanya whitespace → invalid
   - targetAmount = 0 → invalid
   - targetAmount negatif → invalid
   - Nama valid + amount positif → valid

5. **Deadline display logic**:
   - Deadline besok → "1 hari lagi"
   - Deadline kemarin, goal belum tercapai → "Terlambat"
   - Deadline ada, goal sudah tercapai → tidak tampilkan "Terlambat"

### Property-Based Tests

Menggunakan library **fast-check** (TypeScript/JavaScript).

Setiap property test dijalankan minimum **100 iterasi**.

Tag format: `Feature: savings-goals, Property {N}: {property_text}`

**Property 1 — Keyword Matcher case-insensitive:**
```
// Feature: savings-goals, Property 1: isSavingsKeyword is case-insensitive
// Generate random casing variants of keywords (tabungan, nabung, dana darurat, investasi, dll.)
// Assert: isSavingsKeyword(variant) === true for all variants
// Assert: isSavingsKeyword(nonSavingsCategory) === false for all non-savings strings
```

**Property 2 & 3 — Cashflow Hybrid formula:**
```
// Feature: savings-goals, Property 2 & 3: cashflow hybrid formula invariant
// Generate: random list of transactions with random types (income/expense/savings-category)
// Assert: totalExpense = sum of non-savings expense transactions
// Assert: totalSavings = sum of ALL savings-category transactions (no cap)
// Assert: totalIncome - totalExpense - totalSavings === sisa
// Edge case: totalSavings > any single goal's targetAmount → still counted fully
```

**Property 5 — Contribution total consistency:**
```
// Feature: savings-goals, Property 5: contribution total consistency
// Generate: random list of transactions, some with savings keywords or isSavings=true categories
// Assert: totalContributed === sum of amounts where isSavingsTransaction(category, savingsCategoryNames)
// Assert: no cap applied even when totalContributed > targetAmount
```

**Property 6 — Goal validation:**
```
// Feature: savings-goals, Property 6: invalid goals are rejected
// Generate: random strings for name (including empty/whitespace), random numbers for amount (including ≤ 0)
// Assert: validateGoal({ name, targetAmount }) returns error for invalid inputs
// Assert: validateGoal({ name: nonEmpty, targetAmount: positive }) returns success
```

**Property 7 — DELETE ownership check:**
```
// Feature: savings-goals, Property 7: delete ownership check
// Generate: random userId pairs (owner vs non-owner)
// Assert: DELETE with non-owner userId does not delete the goal
// Assert: goal still exists after unauthorized delete attempt
```

### Integration Tests

- **GET /api/savings** — returns goals list dengan contributions dihitung benar (keyword + isSavings flag)
- **POST /api/savings** — creates goal, persists to DB
- **DELETE /api/savings/[goalId]** — deletes goal dengan ownership check (`userId` filter), returns 404 untuk goal tidak ditemukan atau milik user lain
- **Cashflow hybrid di /api/budget** — `totalExpense` tidak termasuk savings transactions
- **Google Sheets user** — contributions hanya dari keyword matching (isSavings flag tidak berlaku)

### Manual / Visual Tests

- Progress bar tampil benar di berbagai persentase (0%, 50%, 100%, >100% — bar di-cap 100% tapi nominal asli tetap tampil)
- Badge "Tercapai" muncul saat progress ≥ 100%
- Badge "Terlambat" muncul saat deadline lewat dan belum tercapai
- History expand/collapse berfungsi
- Sidebar item "Tabungan" aktif saat di `/dashboard/savings`
- Budget_Table kolom "Budget" menampilkan nominal penuh
- Cashflow summary 4-kolom tampil benar di mobile dan desktop
