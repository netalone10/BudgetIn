# Task List: Double-Entry Accounting System

## Status Legend
- ✅ Done — sudah diimplementasi
- 🔧 Partial — sebagian sudah ada, perlu penyempurnaan
- ⬜ Todo — belum diimplementasi

---

## Task 1: AI Classifier — Account Extraction
**Requirements**: 2.1, 2.2, 6.1–6.5, 18.1–18.5 | **File**: `utils/groq.ts`

- ✅ 1.1 Field `accountName?: string` sudah ada di interface `ParsedRecord`
- ✅ 1.2 Parameter `userAccounts?: string[]` sudah ada di fungsi `classifyIntent`
- ✅ 1.3 Rule 10 (ekstraksi akun) sudah ada di system prompt
- ✅ 1.4 Daftar akun user sudah dikirim sebagai `accountHint` ke Groq
- ✅ 1.5 Format JSON output per intent sudah include `accountName` di Rule 11

---

## Task 2: Account Matching Logic
**Requirements**: 2.2, 2.3, 2.4, 2.5 | **File**: `app/api/record/route.ts`

- ✅ 2.1 Fungsi `matchAccount` sudah ada (inline di route handler)
- ✅ 2.2 Case-insensitive partial matching bidirectional sudah diimplementasi
- ✅ 2.3 Return `accountId` jika match ditemukan
- ✅ 2.4 Handle multiple matches — return `{ ambiguous, matches[] }` → clarification "Akun mana yang dimaksud? Pilih salah satu: ..."

---

## Task 3: Clarification Message Generator
**Requirements**: 1.4, 3.1–3.5 | **File**: `app/api/record/route.ts`

- ✅ 3.1 Fungsi `askAccountSelection` sudah ada (inline di route handler)
- ✅ 3.2 Handle zero accounts: "Belum ada akun. Buat akun dulu di menu Akun sebelum input transaksi."
- ✅ 3.3 Handle expense tanpa akun dengan format yang benar
- ✅ 3.4 Handle income tanpa akun dengan format yang benar
- ✅ 3.5 Semua nama akun aktif disertakan dalam pesan klarifikasi

---

## Task 4: API — POST /api/record (AI Input)
**Requirements**: 1.1, 1.3–1.5, 7.1–7.5, 8.1–8.5, 11.1–11.5, 16.1–16.5, 20.1–20.5 | **File**: `app/api/record/route.ts`

- ✅ 4.1 Fetch akun aktif user sebelum `classifyIntent`
- ✅ 4.2 Pass daftar akun ke `classifyIntent`
- ✅ 4.3 Panggil `matchAccount` setelah AI classification
- ✅ 4.4 Gunakan `accountId` hasil match untuk transaksi
- ✅ 4.5 Return clarification jika tidak ada match
- ✅ 4.6 Validasi `accountId` lengkap — `validateAccount()` helper memvalidasi existence, ownership, dan `isActive` di semua intent (transaksi, bulk, pemasukan)
- ✅ 4.7 Error messages konsisten: "Akun tidak ditemukan" / "Akun tidak valid" / "Akun sudah dinonaktifkan"
- ✅ 4.8 Bulk transaction: validasi `accountId` sekali, apply ke semua item; reject jika tidak ada akun
- ✅ 4.9 Response sukses menyertakan `accountName` (diambil dari `userAccounts` array)

---

## Task 5: API — POST /api/transactions/manual
**Requirements**: 1.1, 1.2, 1.5, 7.1–7.5, 8.1–8.5, 9.1–9.5, 16.1–16.5, 19.1–19.5, 20.1–20.5 | **File**: `app/api/transactions/manual/route.ts`

- ✅ 5.1 Validasi `accountId` wajib ada
- ✅ 5.2 Validasi akun: harus ada, milik user, dan `isActive = true`
- ✅ 5.3 Transfer: validasi `accountId !== toAccountId`
- ✅ 5.4 Transfer: validasi currency sama
- ✅ 5.5 Transfer: buat dua transaksi linked dengan `transferId` yang sama
- ✅ 5.6 Error messages dibedakan sesuai Req 16: "Akun tidak ditemukan" / "Akun tidak valid" / "Akun sudah dinonaktifkan" (untuk akun asal dan tujuan transfer)
- ✅ 5.7 Response sukses menyertakan `accountName`

---

## Task 6: Manual Transaction Form UI
**Requirements**: 1.2, 5.1–5.5, 17.1–17.5 | **File**: `components/ManualTransactionForm.tsx`

- ✅ 6.1 State `accountId` dan `toAccountId` sudah ada
- ✅ 6.2 Akun diterima sebagai prop (fetch dilakukan di parent)
- ✅ 6.3 Dropdown dikelompokkan per `AccountType` dengan `<optgroup>`
- ✅ 6.4 Field `required` sudah ada di select, tapi submit button tidak di-disable secara eksplisit saat `accountId` kosong — hanya mengandalkan HTML `required`
- ✅ 6.5 Zero-account state: tampilkan pesan + tombol "Buat Akun Pertama →"
- ✅ 6.6 Dropdown `toAccountId` untuk tab Transfer sudah ada
- ✅ 6.7 Opsi akun yang sama di-disable di dropdown tujuan transfer
- ✅ 6.8 Currency ditampilkan di samping nama akun jika user punya akun multi-currency (`isMultiCurrency` flag)
- ✅ 6.9 Akun di-sort alfabetis dalam setiap grup (`.sort((a, b) => a.name.localeCompare(b.name))`)

---

## Task 7: Google Sheets Integration — Account Support
**Requirements**: 12.1–12.5 | **File**: `utils/sheets.ts`

- ✅ 7.1 Kolom `accountId` (H) dan `accountName` (I) ditambahkan ke struktur baris Transaksi Sheet
- ✅ 7.2 `appendTransaction` menyertakan `accountId` dan `accountName` dalam row data (kolom H & I)
- ✅ 7.3 Parser `getTransactions` membaca kolom H (`accountId`) dan I (`accountName`), range diupdate ke `A2:I`
- ✅ 7.4 Legacy rows tanpa `accountId` sudah di-handle gracefully (field optional di interface)
- ✅ 7.5 `createGoogleSheet` header Transaksi diupdate dari `A:G` ke `A:I`; juga fix duplicate `return` bug di `appendTransaction`

---

## Task 8: Database Transaction Storage
**Requirements**: 4.1–4.5, 13.1–13.5 | **File**: `utils/db-transactions.ts`, `prisma/schema.prisma`

- ✅ 8.1 Schema Prisma: `accountId` nullable untuk legacy, enforced di application layer
- ✅ 8.2 Index `[userId, accountId]`, `[userId, date]`, dan `[transferId]` sudah ada di schema
- ✅ 8.3 `CreateInput.accountId` diubah menjadi required (`accountId: string`) — enforced di application layer
- ✅ 8.4 `DbTransaction` interface diperluas: `type` mencakup `transfer_out` | `transfer_in`, dan `accountId: string | null` ditambahkan; return value `appendTransactionDB` dan `getTransactionsDB` sudah menyertakan `accountId`
- ✅ 8.5 `onDelete: SetNull` sudah dikonfigurasi di schema

---

## Task 9: Balance Calculation — Verification
**Requirements**: 7.2, 8.2, 9.4, 9.5, 14.1–14.5 | **File**: `utils/account-balance.ts`

- ✅ 9.1 `account-balance.ts` tidak perlu diubah — sudah menggunakan ledger-based calculation
- ✅ 9.2 Formula sudah benar: `initialBalance` tidak dipakai, murni dari transaksi
- ✅ 9.3 Transaksi dengan `accountId = null` sudah dikecualikan (`accountId: { not: null }`)
- ✅ 9.4 Liability balance: expense menambah saldo, transfer_in mengurangi — sudah benar karena formula sama untuk semua akun

---

## Task 10: Property-Based Tests
**Requirements**: Design doc Properties 1–10 | **File**: `lib/__tests__/`

- ⬜ 10.1 Cek apakah `fast-check` sudah ada di `package.json`; install jika belum
- ⬜ 10.2 **Property 1** — Account Name Matching: match iff exactly one account matches (case-insensitive, bidirectional)
- ⬜ 10.3 **Property 2** — Account Validation: accept iff akun ada, milik user, dan aktif
- ⬜ 10.4 **Property 3** — Clarification Message Completeness: pesan selalu berisi semua akun aktif + wording sesuai tipe + contoh
- ⬜ 10.5 **Property 5** — Ledger Balance Calculation: saldo = income + transfer_in - expense - transfer_out (null accountId dikecualikan)
- ⬜ 10.6 **Property 6** — Transfer Pairing: transfer selalu menghasilkan tepat 2 transaksi dengan `transferId` yang sama
- ⬜ 10.7 **Property 7** — Transfer Validation: accept iff source ≠ destination, keduanya aktif, milik user, currency sama
- ⬜ 10.8 **Property 8** — Bulk Atomicity: jika `accountId` invalid, zero transaksi tersimpan
- ⬜ 10.9 **Property 9** — Credit Card Liability Balance: expense menambah saldo liability, transfer_in mengurangi
- ⬜ 10.10 **Property 10** — Account Ownership Isolation: user tidak bisa pakai akun milik user lain
- ⬜ 10.11 Setiap test harus include comment tag: `// Feature: double-entry-accounting-system, Property N: ...`
- ⬜ 10.12 Minimum 100 iterations per property test (`numRuns: 100`)

---

## Task 11: Manual Testing & Verification

- ⬜ 11.1 AI input dengan nama akun ("makan 50rb pakai BCA") → transaksi tersimpan dengan `accountId` benar
- ⬜ 11.2 AI input tanpa nama akun → clarification message muncul dengan daftar akun
- ⬜ 11.3 AI input dengan user yang belum punya akun → pesan arahkan ke pembuatan akun
- ⬜ 11.4 Bulk transaction dengan dan tanpa menyebut akun
- ⬜ 11.5 Manual form: submit tanpa pilih akun → tombol disabled / form tidak submit
- ⬜ 11.6 Manual form: dropdown akun terkelompok per tipe
- ⬜ 11.7 Transfer: akun sumber = tujuan → error "Akun asal dan tujuan tidak boleh sama."
- ⬜ 11.8 Transfer: beda currency → error dengan pesan yang sesuai
- ⬜ 11.9 Akun inactive → error "Akun sudah dinonaktifkan"
- ⬜ 11.10 `accountId` milik user lain → error "Akun tidak valid"
- ⬜ 11.11 Saldo akun update setelah expense, income, dan transfer
- ⬜ 11.12 Saldo kartu kredit (liability) update dengan benar
- ⬜ 11.13 Transaksi legacy (null `accountId`) tidak mempengaruhi kalkulasi saldo

---

## Ringkasan Pekerjaan yang Tersisa

### Tests (satu-satunya yang belum)
| # | Pekerjaan |
|---|-----------|
| 10.1–10.12 | Tulis property-based tests untuk 10 properties di design doc |

### Manual Testing
| # | Pekerjaan |
|---|-----------|
| 11.1–11.13 | Verifikasi end-to-end semua flow secara manual |
