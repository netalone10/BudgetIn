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

### C2 — Budget Limit Alerts `[P1]`  ✅ SELESAI (2026-06-01)

**Problem**: User tidak tahu ketika budget kategori mendekati atau melebihi limit sebelum akhir bulan.

**Implementasi**:
- `lib/budget-alerts.ts` — helper murni `computeBudgetAlerts(budgets, warnThreshold=0.8)` → level `warn` (≥80%) / `over` (≥100%), pakai effective budget (budget + rollover), urut rasio tertinggi. + `lib/__tests__/budget-alerts.test.ts` (10 kasus)
- `components/dashboard/BudgetAlertCard.tsx` — kartu di sidebar dashboard, hanya muncul saat ada alert; progress bar + persentase + link ke /dashboard/budget
- `app/dashboard/DashboardClient.tsx` — render BudgetAlertCard di atas sidebar, pakai `budgetData?.budgets` (tanpa API baru)

**Kriteria selesai**:
- ✅ Alert muncul saat spending ≥ 80% budget per kategori (warn) dan ≥100% (over)
- ✅ Angka identik dengan halaman Budget (effective budget = budget + rollover)
- ✅ Transfer/equity tidak masuk hitungan (spent dihitung via isExpenseTransaction di hulu)

**Catatan**: Email alert (opsional di plan) di-skip — fokus ke dashboard card. Bisa disusulkan via cron + dedup state bila diperlukan.

---

### C3 — Deterministic Insight Cards `[P1]`  ✅ SELESAI (2026-06-01)

**Problem**: Halaman analyst bergantung penuh pada Groq — jika Groq unavailable, route men-500-kan seluruh response sehingga insight deterministik (health score, breakdown kategori, top expenses, rekomendasi otomatis) yang sudah dihitung server-side ikut hilang.

**Temuan**: Insight deterministik **sudah** dihitung server-side (`healthScore`, `overBudget`, `categoryPercentages`, `topExpenses`, `dailyAvgSpending`, `fmRecommendations`) dan **sudah** dirender sebagai cards di AnalystClient (section 04/05/06 + sidebar). Yang dari AI hanya section 01/02/03 (summary, rekomendasi, anomali). Gap satu-satunya: kegagalan Groq menjatuhkan semuanya.

**Implementasi**:
- `app/api/analyst/route.ts` — panggilan Groq dibungkus try/catch terpisah; bila gagal → narasi kosong + flag `aiUnavailable: true`, tapi semua field deterministik tetap dikembalikan (200, bukan 500).
- `app/dashboard/analyst/AnalystClient.tsx` — tambah notice "Narasi AI tidak tersedia, insight tetap akurat"; section summary (01) & rekomendasi AI (02) hanya tampil bila ada isinya; section deterministik tetap render.

**Kriteria selesai**:
- ✅ Insight (deterministik) tetap muncul walau Groq gagal
- ✅ Angka konsisten (dihitung dari data yang sama; spending bebas transfer/savings via analyst-metrics)

**Catatan**: "Unusual spending vs rata-rata 3 bulan" (di scope awal) di-skip — butuh fetch 3 bulan tambahan; prediksi tren bulan depan sudah ada di endpoint `/api/prediction`.

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

### C5 — Budget Templates `[P2]`  ✅ SUDAH ADA (verifikasi 2026-06-01)

**Problem**: Membuat budget dari nol setiap bulan repetitif.

**Temuan**: Fitur "salin budget bulan lalu" **sudah terimplementasi penuh** — tidak perlu pekerjaan baru.
- Backend: `app/api/budget/rollover/route.ts` POST `{ sourceMonth, targetMonth }` menyalin semua budget antar-bulan via upsert (`$transaction`).
- UI: `app/dashboard/budget/BudgetClient.tsx` — `handleCopyPreviousMonth()` (sourceMonth = bulan sebelumnya) + tombol "Copy dari Bulan Lalu" / "Overwrite dari Bulan Lalu" dengan **konfirmasi dua-klik** (`copyConfirm`) bila sudah ada budget bulan ini.

**Kriteria selesai**:
- ✅ Duplikasi budget bulan sebelumnya
- ✅ Konfirmasi sebelum overwrite (proteksi budget existing)

**Catatan**: "Partial apply (pilih kategori)" di scope awal tidak ada — saat ini salin semua. Bisa ditambah nanti bila perlu.

---

### C6 — Export Laporan Keuangan PDF `[P2]`  ✅ SUDAH ADA (verifikasi 2026-06-01)

**Problem**: Income Statement, Owner's Equity, Balance Sheet belum bisa di-print/share.

**Temuan**: Sudah terimplementasi via print-to-PDF native browser — tidak perlu pekerjaan baru.
- `app/dashboard/report/ReportClient.tsx` — `handlePrint()` → `window.print()` + tombol "Print / Simpan PDF"; kontrol diberi `print:hidden`.
- Print CSS matang: `@media print` + `@page` (termasuk landscape) di `app/globals.css`, plus utility `print:` di semua komponen report (Monthly/Yearly/CustomRange/OwnerEquity/BalanceSheet).

**Kriteria selesai**:
- ✅ Print/Save-as-PDF rapi (print CSS + kontrol disembunyikan)
- ✅ Angka identik dengan UI (mencetak DOM yang sama)

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
