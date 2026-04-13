# Implementation Plan: Savings Goals & Cashflow Hybrid

## Overview

Implementasi fitur Savings Goals dan Cashflow Hybrid secara incremental: mulai dari schema DB, utility functions, API routes, UI components, lalu integrasi ke sidebar dan dashboard. Property-based tests menggunakan fast-check untuk memvalidasi logika inti.

## Tasks

- [x] 1. Update Prisma schema dan jalankan migrasi
  - Tambah model `SavingsGoal` ke `prisma/schema.prisma` dengan fields: `id`, `userId`, `name`, `targetAmount`, `deadline`, `createdAt`, relasi ke `User` dengan `onDelete: Cascade`
  - Tambah field `isSavings Boolean @default(false) @map("is_savings")` ke model `Category`
  - Tambah relasi `savingsGoals SavingsGoal[]` ke model `User`
  - Jalankan `npx prisma db push` dan regenerate Prisma client
  - _Requirements: 1.1, 2.3, 2.4, 5.1_

- [ ] 2. Buat utility `lib/savings-utils.ts`
  - [x] 2.1 Implementasi `SAVINGS_KEYWORDS`, `isSavingsKeyword()`, dan `isSavingsTransaction()`
    - Definisikan `SAVINGS_KEYWORDS` array dengan semua variasi keyword bahasa Indonesia dari design
    - Implementasi `isSavingsKeyword(category: string): boolean` — case-insensitive, cek apakah category mengandung salah satu keyword
    - Implementasi `isSavingsTransaction(category: string, savingsCategoryNames: Set<string>): boolean` — OR logic antara keyword match dan isSavings flag
    - Export semua fungsi dan konstanta
    - _Requirements: 2.1, 2.2, 2.5_

  - [x] 2.2 Tulis property test untuk `isSavingsKeyword` (Property 1)
    - **Property 1: Keyword Matcher — case-insensitive detection**
    - Generate random casing variants dari setiap keyword di `SAVINGS_KEYWORDS` (uppercase, lowercase, mixed)
    - Assert: `isSavingsKeyword(variant) === true` untuk semua variant
    - Generate random non-savings strings (tanpa keyword apapun)
    - Assert: `isSavingsKeyword(nonSavings) === false`
    - **Validates: Requirements 2.1, 2.2**

  - [x] 2.3 Tulis property test untuk cashflow hybrid formula (Property 2 & 3)
    - **Property 2: Savings excluded from expense**
    - **Property 3: Cashflow formula invariant — `totalIncome − totalExpense − totalSavings = sisa`**
    - Generate random list transaksi dengan tipe income/expense/savings-category
    - Assert: `totalExpense` hanya berisi non-savings, non-income transactions
    - Assert: `totalSavings` = sum semua savings transactions tanpa cap
    - Assert: `totalIncome - totalExpense - totalSavings === sisa`
    - **Validates: Requirements 4.1, 4.3, 4.4**

  - [ ] 2.4 Tulis property test untuk contribution total consistency (Property 5)
    - **Property 5: Contribution total consistency**
    - Generate random list transaksi, sebagian dengan savings keywords atau isSavings=true
    - Assert: `totalContributed === sum(amount)` untuk semua matching transactions
    - Assert: tidak ada cap meskipun `totalContributed > targetAmount`
    - **Validates: Requirements 2.5, 3.2**

- [x] 3. Checkpoint — Pastikan semua tests utility pass
  - Pastikan semua tests pass, tanya user jika ada pertanyaan.

- [ ] 4. Buat API routes untuk Savings Goals
  - [x] 4.1 Implementasi `app/api/savings/route.ts` (GET + POST)
    - **GET**: Query `prisma.savingsGoal.findMany({ where: { userId } })`, fetch savings categories dengan `isSavings: true`, fetch transactions bulan ini (DB atau Sheets), hitung `totalContributed` dan `contributions[]` per goal menggunakan `isSavingsTransaction()`, return `{ goals: SavingsGoalWithProgress[] }`
    - **POST**: Validasi `name` (non-empty, non-whitespace) dan `targetAmount` (> 0), buat goal baru dengan `prisma.savingsGoal.create()`, return `{ goal }`
    - Handle Google Sheets user: fetch via `getTransactions()` sekali, filter di memory
    - Handle error: 401 unauthenticated, 400 invalid input, 500 DB error
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.5, 2.6, 3.1, 3.2, 5.1_

  - [ ] 4.2 Tulis property test untuk goal validation (Property 6)
    - **Property 6: Goal validation rejects invalid input**
    - Ekstrak logika validasi ke fungsi `validateGoal({ name, targetAmount })` yang bisa ditest secara unit
    - Generate random strings untuk name (termasuk empty/whitespace-only)
    - Generate random numbers untuk targetAmount (termasuk ≤ 0)
    - Assert: `validateGoal` return error untuk input invalid
    - Assert: `validateGoal` return success untuk name non-empty + targetAmount positif
    - **Validates: Requirements 1.3**

  - [x] 4.3 Implementasi `app/api/savings/[goalId]/route.ts` (DELETE)
    - **DELETE**: Verifikasi session, jalankan `prisma.savingsGoal.delete({ where: { id: goalId, userId: session.userId } })`
    - Tangkap Prisma error P2025 → return 404 `{ error: "Goal tidak ditemukan" }` (berlaku untuk goal tidak ada MAUPUN goal milik user lain — intentionally 404 bukan 403)
    - Return `{ success: true }` jika berhasil
    - _Requirements: 1.4, 5.2, 5.3_

  - [ ] 4.4 Tulis property test untuk DELETE ownership check (Property 7)
    - **Property 7: DELETE ownership check**
    - Buat helper `checkOwnership(goalUserId: string, requestUserId: string): boolean`
    - Generate random userId pairs (owner vs non-owner)
    - Assert: `checkOwnership(ownerId, differentUserId) === false`
    - Assert: `checkOwnership(ownerId, ownerId) === true`
    - **Validates: Requirements 5.2, 5.3**

- [x] 5. Checkpoint — Pastikan semua tests API pass
  - Pastikan semua tests pass, tanya user jika ada pertanyaan.

- [x] 6. Buat komponen `components/SavingsGoalCard.tsx`
  - Implementasi card dengan props `{ goal: SavingsGoalWithProgress; onDelete: (goalId: string) => void }`
  - Tampilkan: nama goal, progress bar (di-cap 100%), nominal `totalContributed / targetAmount`
  - Badge "Tercapai" (hijau) jika `totalContributed >= targetAmount`
  - Badge "Terlambat" (merah/oranye) jika deadline lewat dan belum tercapai; tampilkan sisa hari jika deadline belum lewat
  - Tombol expand/collapse untuk history kontribusi (`contributions[]`)
  - Tombol hapus goal dengan konfirmasi
  - Catatan kode: `totalContributed` tidak di-cap di display nominal, hanya progress bar yang di-cap 100%
  - _Requirements: 1.5, 1.6, 1.7, 3.1, 3.2, 3.3, 3.4_

- [x] 7. Buat halaman `app/dashboard/savings/page.tsx`
  - Fetch goals dari `GET /api/savings` saat mount
  - Form inline untuk buat goal baru: input nama, input target amount, optional deadline date picker
  - Client-side validation sebelum submit (nama kosong, amount ≤ 0) dengan error message inline
  - Render daftar `SavingsGoalCard` untuk setiap goal
  - Handle delete: panggil `DELETE /api/savings/[goalId]`, update state lokal
  - Empty state jika belum ada goals
  - Error state dengan tombol retry jika fetch gagal
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.3, 3.4_

- [x] 8. Update `components/Sidebar.tsx` — tambah nav item "Tabungan"
  - Import icon `PiggyBank` (atau `Wallet`) dari lucide-react
  - Tambah `{ name: "Tabungan", href: "/dashboard/savings", icon: PiggyBank }` ke array `navItems`, posisikan setelah "Dashboard" dan sebelum "AI Analyst"
  - Nav item aktif saat `pathname === "/dashboard/savings"` (sudah handled oleh logika `isActive` yang ada)
  - _Requirements: 1.1_

- [ ] 9. Update `components/DashboardTabs.tsx` — cashflow hybrid formula
  - [x] 9.1 Integrasi `isSavingsTransaction()` ke cashflow calculation
    - Import `isSavingsTransaction` dari `lib/savings-utils`
    - Tambah prop `savingsCategoryNames?: Set<string>` ke interface `Props` (opsional, default empty Set untuk backward compat)
    - Pisahkan `expenseTxs` menjadi dua: savings transactions dan non-savings expense transactions
    - Hitung `totalSavings = sum(savingsTxs)` dan `totalExpense = sum(nonSavingsExpenseTxs)`
    - Hitung `sisa = totalIncome - totalExpense - totalSavings`
    - _Requirements: 4.1, 4.3, 4.4_

  - [x] 9.2 Update summary cards dari 3 kolom menjadi 4 kolom
    - Ubah grid dari `grid-cols-3` menjadi `grid-cols-4` (atau `grid-cols-2 sm:grid-cols-4` untuk mobile)
    - Ganti card "Net" dengan dua card baru: "Tabungan" (nilai `totalSavings`, warna biru/ungu) dan "Sisa" (nilai `sisa`, warna hijau/merah sesuai sign)
    - _Requirements: 4.2_

  - [x] 9.3 Pisahkan section "Tabungan/Alokasi" di cashflow view
    - Filter savings transactions dari `expenseTxs` sebelum dikirim ke `CategorySection` "Pengeluaran"
    - Tambah `CategorySection` baru "Tabungan/Alokasi" jika ada savings transactions
    - _Requirements: 4.3_

- [x] 10. Update `app/dashboard/page.tsx` — pass `savingsCategoryNames` ke DashboardTabs
  - Fetch savings categories dari DB (untuk email users): `prisma.category.findMany({ where: { userId, isSavings: true } })`
  - Pass `savingsCategoryNames` sebagai prop ke `DashboardTabs`
  - Untuk Google users: pass empty Set (keyword matching sudah handle di dalam DashboardTabs)
  - _Requirements: 2.4, 2.6, 4.1_

- [x] 11. Update `components/ManageCategoriesModal.tsx` — toggle `isSavings` per kategori
  - Update interface `Category` lokal untuk include `isSavings: boolean`
  - Tambah toggle/switch di setiap category row untuk mengubah `isSavings` flag
  - Panggil `PATCH /api/categories/[categoryId]` dengan `{ isSavings: boolean }` saat toggle berubah
  - Tampilkan badge visual (misal: "💰 Tabungan") pada kategori yang `isSavings = true`
  - _Requirements: 2.3, 2.4_

- [x] 12. Update `app/api/categories/[categoryId]/route.ts` — support update `isSavings`
  - Tambah handling untuk field `isSavings` di PATCH handler
  - Update `prisma.category.update()` untuk include `isSavings` jika ada di request body
  - _Requirements: 2.3, 2.4_

- [x] 13. Fix budget table — kolom "Budget" tampilkan nominal penuh
  - Di `components/DashboardTabs.tsx`, ubah kolom "Budget" di tabel dari `fmtCompact(item.budget)` menjadi `fmt(item.budget)`
  - _Requirements: 6.1_

- [x] 14. Checkpoint final — Pastikan semua tests pass dan fitur terintegrasi
  - Pastikan semua tests pass, tanya user jika ada pertanyaan.

## Notes

- Tasks bertanda `*` bersifat opsional dan bisa dilewati untuk MVP lebih cepat
- Property tests menggunakan fast-check — install jika belum ada: `npm install --save-dev fast-check`
- Setiap property test harus dijalankan minimum 100 iterasi
- Tag format untuk property tests: `Feature: savings-goals, Property {N}: {property_text}`
- `totalContributed` tidak pernah di-cap di cashflow view — konsistensi antara card view dan cashflow view wajib dijaga
- Google Sheets users: deteksi savings hanya via keyword matching, `isSavings` flag tidak berlaku
- DELETE goal selalu return 404 (bukan 403) untuk goal tidak ditemukan atau milik user lain — ini intentional untuk tidak leak existence
