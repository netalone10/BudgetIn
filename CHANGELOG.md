# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/), semver.

## [1.13.2] — 2026-06-01

### Added
- **Export CSV transaksi.** Tombol "Export CSV" di halaman Transaksi mengunduh seluruh transaksi periode aktif (`GET /api/export/csv`) dengan kolom Tanggal, Waktu, Tipe, Kategori, Nominal, Akun, Akun Tujuan, Catatan. BOM UTF-8 agar rapi di Excel.

### Fixed
- **Halaman Berulang error tidak bisa dibuka** (`items.filter is not a function`). `GET /api/recurring` berubah mengembalikan `{ data, pagination }` sejak penambahan pagination, tapi client masih membacanya sebagai array. Sekarang membaca `.data`.
- **Transaksi berulang overdue tidak tercatat.** Query auto-record cron hanya menangkap item yang jatuh tempo tepat hari ini; item yang sudah lewat jatuh tempo terlantar dan tidak pernah tercatat. Sekarang menangkap due hari ini + overdue (catch-up), aman dari pencatatan ganda via dedup `occurrenceKey`.

### Changed
- Trigger cron `/api/cron/recurring` dipindah ke GitHub Actions (`.github/workflows/recurring-cron.yml`); entri cron tersebut dihapus dari `vercel.json` (menyisakan `sync-sheets-counts`).

## [1.13.1] — 2026-05-30

### Fixed
- **Konsistensi label surplus/defisit.** Dashboard dan Analyst sekarang menampilkan "defisit" saat nilai negatif, bukan tetap "surplus". Report sudah benar sebelumnya.
- **Trend label terpotong di mobile.** KPICard trend text sekarang wrap 2 baris (`line-clamp-2`) instead of terpotong (`truncate`).
- **Dashboard `Math.abs` amount.** Samakan dengan Report — semua perhitungan expense/income di Dashboard pakai `Math.abs(t.amount)` agar konsisten kalau ada transaksi amount negatif.
- **Filter "Hari ini" dan "Kemarin" di Google Sheets.** `sheets.ts` tidak punya handler untuk kedua period ini — fallback return semua data. Sekarang difilter dengan benar.
- **`isEquityTransaction` di Dashboard & Transaksi client-side.** Samakan dengan Report — catch "Saldo Awal" dan "Penyesuaian Saldo".

## [1.13.0] — 2026-05-29

### Added
- **Laporan Keuangan lengkap** di `/dashboard/report` dengan switcher dua level (jenis laporan × periode):
  - **Income Statement (Laba Rugi)** — laporan existing (Bulanan / Custom / Tahunan), kini dikelompokkan di bawah menu jenis laporan.
  - **Statement of Owner's Equity (Perubahan Ekuitas)** — waterfall `Modal Awal + Laba Bersih − Penarikan (tabungan/investasi) ± Penyesuaian Ekuitas = Modal Akhir`, dengan baris rekonsiliasi agar selalu balance.
  - **Balance Sheet (Neraca)** — snapshot per tanggal (date picker), kolom Aset vs Liabilitas + Ekuitas, dan banner identitas `Aset = Liabilitas + Ekuitas`.
- Helper murni `aggregateOwnerEquity()` & `buildBalanceSheet()` di `lib/report-data.ts`, plus `getAccountBalancesAsOf()` di `utils/account-balance.ts` untuk saldo per tanggal.
- Mode API baru pada `/api/report`: `equity` dan `balance` (reuse perhitungan saldo/net worth existing untuk jalur DB & Google Sheets).
- **Lupa Password (forgot password flow)** lengkap dengan email reset.
- **Welcome email** otomatis saat pengguna pertama kali login via Google.

### Changed
- Menyamakan total Pemasukan & Pengeluaran di dashboard dengan halaman Report & Rincian — setoran tabungan/investasi dan transaksi equity tidak lagi terhitung sebagai pemasukan/pengeluaran.
- Saldo Awal dan Penyesuaian Saldo diperlakukan sebagai mutasi ekuitas murni via helper `isEquityTransaction` — dikecualikan dari laba rugi secara konsisten di dashboard, report, rincian, analyst, dan cashflow.
- Ekuitas pada Balance Sheet dihitung `total aset − total liabilitas (bertanda)` agar konsisten dengan Kekayaan Bersih di dashboard dan `/api/accounts`.
- Perceived performance: klik instan di semua halaman.

### Fixed
- Akun transfer tidak tersimpan saat mengedit transaksi (EditModal account reset fallback).
- Duplikasi `emitDataChanged` pada kartu transaksi terbaru.
- Filter "Minggu ini" di Google Sheets sekarang pakai Monday-Sunday calendar week (sama dengan DB). Sebelumnya Sheets user melihat rolling 7 hari terakhir.

## [1.12.0] — 2026-05-13

### Added
- **Halaman Rincian Pemasukan & Pengeluaran** (`/dashboard/details`) — drill-down per kategori dalam satu halaman dengan sub-tab Pemasukan / Pengeluaran.
  - Accordion per kategori: klik baris untuk expand dan lihat transaksi anggotanya secara lazy-mount.
  - Filter periode (hari ini / minggu ini / bulan ini / bulan lalu / custom range), pencarian teks, filter akun, dan filter kategori dengan semantik AND.
  - Share bar kontribusi tiap kategori terhadap total tab aktif.
  - Edit & hapus transaksi inline via `TransactionCard` yang sudah ada.
  - Angka per kategori konsisten dengan `/dashboard/report` (rule eksklusi Saldo Awal, transfer principal, dan savings identik).
  - Error handling: sesi expired → pesan login ulang; network/5xx → tombol "Coba lagi"; custom range invalid → helper text.
- **Navigasi sidebar** — entri "Rincian" dengan ikon `ListTree` ditambahkan di grup Insights antara Kalender dan Report.
- **Avatar picker Dicebear** untuk pengguna email — pilih avatar dari koleksi Dicebear langsung di profil.
- **Runway Kas** — kartu dashboard baru yang menampilkan estimasi berapa bulan bertahan tanpa pemasukan berdasarkan rata-rata pengeluaran.

### Fixed
- Admin panel layout: sidebar sticky, kolom grid simetris.
- Sidebar sticky scroll menggunakan layout `h-screen overflow-hidden`.
- Mobile truncation, ikon profil sidebar, dan spacing layout dashboard.
- Unifikasi style `NetWorthSummaryCard` dengan grid `KPICard`.
- Cast Dicebear styles ke `Style<object>` untuk resolve type mismatch.

### Changed
- Google OAuth scope diperbarui ke `drive.file` only; ditambahkan disclosure Limited Use sesuai kebijakan Google.
- Profil section sidebar diperbarui dengan UI improvements.

## [1.11.0] — 2026-05-12

### Fixed
- **Email verifikasi gagal silent.** Resend SDK v6 tidak throw pada API error — return `{ data, error }`. Code lama cuma `await` tanpa cek return value, jadi semua error (key invalid, rate limit, domain unverified) hilang tanpa jejak. Akibatnya semua pendaftar baru tidak menerima email verifikasi.
- Register flow sekarang await pengiriman email; kalau gagal, user di-rollback agar bisa retry tanpa stuck di 409 conflict.

### Added
- **Password strength indicator** di form register — bar 4-segmen + checklist Lemah/Sedang/Kuat. Validasi konsisten frontend & backend lewat helper `lib/password-strength.ts` (zero dep, ~1 KB).
- **Endpoint admin diagnostic** `POST /api/admin/test-email` untuk test pengiriman Resend tanpa harus daftar user baru.
- Hint "cek folder Spam/Promotions" di layar post-register & unverified-login.

### Changed
- Cooldown kirim ulang email verifikasi: **5 menit → 1 menit**.
- Logging error Resend di register & resend-verification kini ekspose `message`, `name`, dan raw response untuk diagnosis di Vercel runtime logs.
