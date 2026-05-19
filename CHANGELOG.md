# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/), semver.

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
