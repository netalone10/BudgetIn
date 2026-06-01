# Plan — Pengembangan Fitur & Optimalisasi Performa
# BudgetIn v1.13.0+

**Dibuat**: 2026-06-01  
**Status**: Active Planning  
**Referensi**: `PRD.md`, `ROADMAP.md`, `SYSTEM_MAP.md`, `lib/changelog.ts`

---

## Cara Membaca Dokumen Ini

Dokumen ini adalah working plan konkret — bukan dokumen strategis seperti ROADMAP.md. Setiap item memiliki file yang terpengaruh, kriteria selesai, dan urutan kerja yang jelas. Update dokumen ini setiap kali item selesai atau prioritas berubah.

**Label prioritas:**

| Label | Arti |
|---|---|
| P0 | Harus dikerjakan sebelum fitur baru besar |
| P1 | High-value, dikerjakan setelah P0 tuntas |
| P2 | Valuable, antri setelah P1 |
| P3 | Eksplorasi / large initiative |

---

## Bagian A — Optimalisasi Performa  ✅ SELESAI (verifikasi 2026-06-01)

> **Catatan revisi**: Saat plan ini awalnya disusun, Bagian A dirancang berdasarkan
> 4 "intentional failing tests" di `dashboard-performance-bug.property.test.ts`.
> Setelah membaca kode aktual, **seluruh optimasi Bagian A ternyata sudah
> terimplementasi**. Test tersebut hanya menguji *simulasi* bug lokal dan tidak
> pernah meng-import kode nyata — file itu sudah dihapus (cache-ttl.test.ts
> meng-cover cache asli). Bagian A ditutup. Lihat Bagian B untuk pekerjaan nyata
> berikutnya.

| Item | Status | Bukti di kode |
|---|---|---|
| **A1** Cross-Request TTL Cache | ✅ Done | `lib/cache.ts` — `getCachedDashboardData` (Map, 60s TTL) + `invalidateDashboardCache` dipanggil di 8 mutation routes; dipakai `app/dashboard/page.tsx`; tes `lib/__tests__/cache-ttl.test.ts` (12 pass) |
| **A2** Client-Side SWR | ✅ Done | `DashboardClient.tsx` — `swrFetch` + ETag store + `If-None-Match` + 304 handling + optimistic update + rollback + background revalidation indicator |
| **A3** Parallel DB Queries | ✅ Done | `lib/dashboard-data.ts` memakai `Promise.all` untuk semua query independen (split KPI/secondary fetch untuk granular Suspense) |
| **A4** Code Splitting | ✅ Done | `ReportClient.tsx` lazy-load semua varian report via `dynamic()`; `AnalystClient.tsx` lazy-load `html2canvas`/`jspdf`; `DashboardClient.tsx` lazy-load semua below-fold card |
| **A5** Sheets Caching | ✅ Done | `lib/sheets-data.ts` — `getFullSheetsLedger` (React cache, single-call ledger) + cross-request cache via A1 + fallback (`cacheSheetResponse`/`handleSheetsFallback`) |

**Catatan teknis yang masih bernilai (opsional, bukan blocker)**:
- `cache-ttl.test.ts` me-reimplement logika cache, bukan meng-import `lib/cache.ts`
  langsung (karena `server-only`). Bisa dipertimbangkan refactor agar menguji
  modul asli, tapi kontraknya sudah ter-cover secara positif.
- Lighthouse target tetap perlu diverifikasi berkala: landing ≥ 80, dashboard ≥ 70
  (`lighthouserc.js`).

---

## Bagian B — Fitur Near-Term (P0/P1)  ✅ SELESAI / DITUTUP (verifikasi 2026-06-01)

> **Catatan revisi**: Sama seperti Bagian A, verifikasi ke kode aktual menunjukkan
> hampir seluruh item Bagian B **sudah terimplementasi**. plan.md awalnya disusun
> dari ROADMAP/PRD yang tertinggal versi (PRD v1.8, ROADMAP v1.6.5, padahal produk
> sudah v1.13). Satu-satunya gap nyata (B4 lint) diputuskan untuk **tidak dikerjakan**
> oleh user — validasi tetap memakai `tsc --noEmit` + jest.

| Item | Status | Bukti / Keputusan |
|---|---|---|
| **B1** Rate limiting AI/prompt | ✅ Done | `lib/rate-limit.ts` (sliding window, preset PROMPT 30/m, ANALYST & PREDICTION 10/m, ACCOUNT_MUTATION 10/m). `checkRateLimit` terpasang & return 429 di `app/api/record/route.ts:82`, `app/api/analyst/route.ts:28`, `app/api/prediction/route.ts:30`. Tes: `lib/__tests__/rate-limit.test.ts` (22 kasus). |
| **B2** Test coverage bills & backup | ✅ Done | `lib/__tests__/recurring-utils.test.ts` (17 kasus, bills/recurring) + `lib/__tests__/backup-schema.test.ts` (14 kasus). |
| **B3** Transaction regression suite | ✅ Done | `lib/__tests__/transaction-regression.test.ts` (35 kasus) + suite pendukung (double-entry, transaction-classification, sheets-balance, savings, dll). |
| **B4** Fix lint script | ⏭️ Ditutup (won't-do) | `next lint` rusak di Next 16. Solusi flat-config `eslint .` berhasil dibuat & terbukti jalan, tapi memunculkan 64 error pre-existing (mayoritas rule RC eksperimental react-hooks v6). **User memutuskan tidak memakai lint.** Perubahan di-revert. Validasi tetap `tsc --noEmit` + jest (sesuai catatan PRD §18). |
| **B5** Google token recovery UX | ✅ Done | `AuthErrorContent.tsx` (copy jelas + langkah bernomor + catatan keamanan + CTA reconnect untuk `GooglePermissionRequired`/`OnboardingFailed`). `GoogleSetupRecovery.tsx` (mode reconnect/migrate, loading + error state eksplisit, jaminan "data tidak akan hilang", penjelasan aksi migrate vs mark-complete). |

---

## Bagian C — Fitur Mid-Term (P1/P2)

---

### C1 — Export CSV Transaksi `[P1]`  ✅ SELESAI (2026-06-01)

**Problem**: User tidak bisa download transaksi untuk arsip atau pelaporan eksternal.

**Implementasi**:
- `lib/csv.ts` — utilitas CSV pure (escape RFC 4180, BOM UTF-8, builder transaksi) + `lib/__tests__/csv.test.ts` (16 kasus)
- `app/api/export/csv/route.ts` — `GET /api/export/csv?period=...&from=...&to=...`, auth per-session, cap 5000 baris, header `text/csv` + `Content-Disposition` attachment. Mendukung DB user (resolve nama akun via prisma) & Sheets user (token + nama akun dari ledger). Periode memakai parser yang sama dengan `/api/record`.
- `app/dashboard/transactions/TransactionsClient.tsx` — tombol "Export CSV" di header; export mengikuti periode aktif (bukan filter client, sehingga tidak terbatas 200 baris tampilan).

**Kriteria selesai**:
- ✅ File CSV bisa didownload (kolom: Tanggal, Waktu, Tipe, Kategori, Nominal, Akun, Akun Tujuan, Catatan); BOM UTF-8 agar rapi di Excel
- ✅ Hanya transaksi milik session user (query selalu di-scope `userId`)
- ✅ Nominal angka mentah; transfer ditandai eksplisit lewat kolom Tipe

**Catatan**: Export per-periode menulis semua baris transaksi (termasuk transfer & equity) apa adanya — bukan agregat. Kolom Tipe membedakannya, jadi tidak ada angka menyesatkan.

---

### C2 — Budget Limit Alerts `[P1]`

**Problem**: User tidak tahu ketika budget kategori mendekati atau melebihi limit sebelum akhir bulan.

**Scope**:
- Tambah alert card di dashboard saat kategori mencapai 80% budget
- Tambah alert state untuk kategori yang sudah over-budget
- Hitung spending dengan transfer exclusion (reuse `transaction-classification.ts`)
- Opsional: email alert (pakai Resend yang sudah ada)

**File yang terpengaruh**:
- `lib/budget-data.ts` — tambah alert threshold calculation
- `app/dashboard/DashboardClient.tsx` atau komponen baru — alert cards
- `app/api/budget/route.ts` — sertakan alert data di response

**Kriteria selesai**:
- Alert muncul di dashboard saat spending ≥ 80% budget per kategori
- Alert memakai angka yang sama dengan halaman budget
- Transfer principal tidak masuk hitungan spending

---

### C3 — Deterministic Insight Cards `[P1]`

**Problem**: Halaman analyst bergantung penuh pada Groq — jika Groq unavailable, tidak ada insight sama sekali.

**Scope**:
- Tambah insight cards deterministik sebelum AI narrative:
  - Kategori dengan spending tertinggi bulan ini
  - Kategori yang over-budget
  - Savings goal yang kurang kontribusi (< target bulanan)
  - Unusual spending (bulan ini vs rata-rata 3 bulan lalu)
- AI narrative tetap ada sebagai supplement

**File yang terpengaruh**:
- `app/api/analyst/route.ts` — tambah deterministic insight calculation
- `app/dashboard/analyst/AnalystClient.tsx` — tampilkan insight cards

**Kriteria selesai**:
- Insight cards muncul walau Groq request gagal
- Angka insight konsisten dengan dashboard dan budget page

---

### C4 — User-Configurable Timezone `[P1]`

**Problem**: Semua user dipaksa Asia/Jakarta — user di luar WIB (diaspora, UTC+8 lainnya) salah periode.

**Scope**:
- Tambah field `timezone` di model `User` (Prisma migration)
- Default ke `Asia/Jakarta` untuk user existing
- Update `lib/transaction-time.ts` untuk pakai timezone user
- Update dashboard period boundaries
- UI di `app/dashboard/settings/account/page.tsx`

**File yang terpengaruh**:
- `prisma/schema.prisma` — tambah field `timezone`
- `lib/transaction-time.ts`
- `lib/dashboard-data.ts`
- `app/dashboard/settings/account/page.tsx`
- `app/api/user/route.ts`

**Kriteria selesai**:
- User bisa memilih timezone dari daftar IANA
- Transaksi baru mengikuti timezone user
- User existing tetap default WIB tanpa perubahan data

---

### C5 — Budget Templates `[P2]`

**Problem**: Membuat budget dari nol setiap bulan repetitif, terutama untuk kategori yang sama nilainya.

**Scope**:
- Duplikasi budget dari bulan sebelumnya dengan satu klik
- Preview sebelum apply
- Support partial apply (pilih kategori tertentu)

**File yang terpengaruh**:
- `app/api/budget/template/route.ts` — buat baru (atau extend `app/api/budget/route.ts`)
- `app/dashboard/budget/page.tsx` — tambah tombol "Salin dari bulan lalu"

**Kriteria selesai**:
- User bisa duplikasi budget bulan sebelumnya tanpa merusak budget existing
- Preview jelas sebelum apply

---

### C6 — Export Laporan Keuangan PDF `[P2]`

**Problem**: Income Statement, Owner's Equity, Balance Sheet yang baru selesai dibangun belum bisa di-print/share.

**Scope**:
- Tambah print/PDF view untuk ketiga report
- Pakai CSS `@media print` atau library PDF generation
- Pastikan angka di PDF sama dengan yang ditampilkan di UI

**File yang terpengaruh**:
- `app/dashboard/report/BalanceSheetReport.tsx`
- `app/dashboard/report/OwnerEquityReport.tsx`
- `app/dashboard/report/MonthlyReport.tsx`

**Kriteria selesai**:
- PDF/print view rapi dan bisa dibaca
- Angka identik dengan UI

---

## Bagian D — Fitur Long-Term (P3)

Item ini membutuhkan riset teknis atau redesign signifikan. Tidak dijadwalkan sampai P0/P1 tuntas.

| Item | Deskripsi | Blocker |
|---|---|---|
| Bank Statement Import | CSV import dari BCA, Mandiri, GoPay, OVO | Perlu column mapping wizard + duplicate detection |
| Shared Household Budget | Dua user kelola budget bersama | Butuh schema redesign (workspace model + RBAC) |
| Multi-Language (i18n) | UI dalam Bahasa Indonesia dan English | Butuh ekstraksi semua UI strings + i18n framework |
| PWA / Offline-First | Draft transaksi offline, sync saat online | Butuh service worker + conflict resolution |

---

## Urutan Pengerjaan yang Disarankan

```
Minggu 1–2: A1 (cross-request cache) + B1 (rate limiting) + B4 (lint fix)
Minggu 3–4: B2 (bills & backup tests) + B3 (transaction regression suite)
Minggu 5:   B5 (Google token recovery UX) + A2 (SWR client-side)
Minggu 6:   A3 (DB query optimization) + A5 (Sheets caching)
Minggu 7–8: C1 (CSV export) + C2 (budget alerts) + C3 (deterministic insights)
Minggu 9+:  C4 (timezone) + C5 (budget templates) + C6 (PDF export)
Long-term:  D items setelah semua P0/P1 selesai
```

---

## Validation Checklist per Item

Sebelum PR merge untuk setiap item:

- [ ] `npx tsc --noEmit` bersih
- [ ] `npx jest` — tidak ada regression di test yang sebelumnya pass
- [ ] Transfer principal tidak masuk expense di semua path yang diubah
- [ ] Data user lain tidak bisa diakses (auth check di semua API baru)
- [ ] Tidak ada `console.log` debug yang tertinggal

---

## File Index (File Kunci yang Sering Tersentuh)

| File | Peranan |
|---|---|
| `lib/dashboard-data.ts` | Data utama dashboard server-side |
| `lib/transaction-classification.ts` | Classifier transfer exclusion |
| `utils/account-balance.ts` | Kalkulasi saldo akun |
| `lib/transaction-time.ts` | Normalisasi waktu transaksi |
| `lib/report-data.ts` | Data laporan keuangan |
| `lib/performance.ts` | Threshold performa + breach detection |
| `app/api/record/route.ts` | NLP prompt endpoint |
| `utils/groq.ts` | Groq intent classification |
| `prisma/schema.prisma` | Model database |
| `utils/sheets.ts` | Google Sheets read/write |
