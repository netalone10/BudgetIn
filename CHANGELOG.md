# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/), semver.

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
