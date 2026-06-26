# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/), semver.

## [1.15.0] — 2026-06-26

### Added
- **Mode Keluarga (read-only consolidated).** Pasangan (mis. suami & istri) tetap mencatat di buku masing-masing, tapi punya "kacamata keluarga" yang mengonsolidasikan keuangan. Keanggotaan (`Family`/`FamilyMember`/`FamilyInvite`) selalu di Postgres, independen dari storage ledger tiap anggota (Sheets vs DB); `family_members` `@@unique([userId])` → 1 user = 1 family (MVP).
- **Halaman `/dashboard/family`** + entri sidebar "Keluarga". Menampilkan Net Worth keluarga (total + per anggota), total pemasukan/pengeluaran, pengeluaran per kategori, ringkasan per anggota, dan transaksi terbaru ber-tag pemilik.
- **Consolidation engine** (`lib/family-data.ts`): `getFamilyLedger` (merge ledger lintas DB+Sheets per anggota, tag `ownerUserId`, degradasi anggun per anggota), `getFamilyNetWorth` (Σ net worth per anggota), `summarizeFamily` (income/expense/kategori/per-orang + eliminasi transfer antar-anggota). Helper scope `lib/family.ts` (`getFamilyContext`, `getFamilyMemberIds`).
- **Alur undangan via email.** `POST /api/family/invite` (owner) mengirim email (`lib/email.ts`) berisi link `/family/join?token=...`; halaman join menampilkan konsen eksplisit sebelum bergabung. `GET/POST /api/family/invite/accept` memvalidasi email penerima cocok dengan tujuan undangan.
- **Transfer antar-anggota (Opsi A — auto 2 kaki).** `POST /api/family/transfer` otomatis membuat sepasang entri ter-link — **expense** di pengirim + **income** di penerima — berbagi `familyTransferId`, ditulis ke store masing-masing (DB via Prisma, Sheets via `appendTransaction` + token tersimpan penerima). Di tampilan keluarga pasangan ini dieliminasi agar tidak double-count. UI form + `GET /api/family/accounts` (daftar akun per anggota).
- **API manajemen:** `GET/POST/DELETE /api/family` (info/buat/bubarkan), `DELETE /api/family/member/[userId]` (keluar/keluarkan), `GET /api/family/dashboard` (data konsolidasi).

### Changed
- **Schema `Transaction`** ditambah kolom opsional `familyTransferId` + `counterpartyUserId` (+ index `familyTransferId`) sebagai penanda transfer antar-anggota.
- **Ledger Google Sheets diperluas ke kolom M-N** (`familyTransferId`, `counterpartyUserId`). `appendTransaction`, `getTransactions`, `updateTransaction`, header (`TRANSACTION_HEADERS` + `ensureTransaksiHeader`), dan `clearBudgetInSheetData` dirapikan ke range `A:N`. Backward-compatible: row lama tanpa kolom tersebut dibaca sebagai `undefined`; edit transaksi mempertahankan marker M-N.

### Catatan
- **Net worth keluarga** = Σ net worth anggota (transfer intra/antar-anggota net-zero terhadap total). Buku pribadi tiap anggota tidak berubah — transfer keluarga tetap tampil sebagai expense/income masing-masing.
- **Atomicity lintas store** (DB+Sheets) pada `POST /api/family/transfer` tidak dijamin DB transaction; dipakai kompensasi best-effort (rollback kaki penerima bila kaki pengirim gagal). Auto-create ke ledger Sheets penerima butuh token tersimpan penerima valid.
- **Asumsi MVP:** semua anggota memakai mata uang sama (IDR); multi-currency di luar scope.

## [1.14.0] — 2026-06-02

### Added
- **LocalStorage cache provider untuk SWR.** Data dashboard di-cache ke `localStorage` sehingga repeat visits menampilkan data secara instan sebelum API respond. Cache di-persist saat `beforeunload`, SSR-safe, dan auto-fallback ke in-memory jika localStorage penuh.
- **Optimistic UI updates untuk semua transaksi.** Ketik "ngopi 42rb" → transaksi langsung muncul di list tanpa menunggu server. Server sync di background. Rollback otomatis + toast error jika gagal (server error, timeout, offline). Input langsung clear untuk feel yang lebih cepat.
- **Error handling granular** untuk optimistic updates: timeout (15s), network offline, server error (4xx/5xx), race condition antar transaksi.

### Changed
- **Dashboard: client-side data fetching.** `page.tsx` menjadi thin auth wrapper (17 baris, turun dari 95 baris). Semua data fetching pindah ke `DashboardClient` via API endpoints. Shell (sidebar + greeting + layout) render instant, data populate via SWR di background.
- **Hapus `loading.tsx` skeleton.** Tidak perlu lagi — shell render instant dari client-side.
- **Sidebar modals: dynamic import.** `ManageCategoriesModal`, `ChangePasswordModal`, `OnboardingModal`, `CalculatorModal` sekarang lazy-loaded via `dynamic()` — mengurangi initial bundle size.

### Removed
- **`@tanstack/react-virtual`** — dead dependency (0 imports, tidak digunakan di manapun).

### Performance
- Edge cache `revalidate = 30` dihapus (tidak relevan dengan client-side fetching).
- Hapus Suspense wrappers + fallback components (data sudah di-resolve di parent).
- Optimistic update: input clear + temp transaction tampil dalam <50ms.
- Bundle size berkurang: Sidebar modals lazy-loaded, @tanstack/react-virtual dihapus.

## [1.13.4] — 2026-06-01

### Fixed
- **Transaksi berulang tidak sinkron untuk pengguna Google Sheets.** `runRecurringOccurrence` (cron auto-record + tombol "Catat") sebelumnya selalu menulis ke `prisma.transaction` (Postgres), padahal ledger pengguna Google ada di Google Sheets — sehingga transaksi recurring tidak pernah muncul di dashboard/laporan. Sekarang bercabang: pengguna Sheets ditulis via `appendTransaction` ke Sheets (expense/income/transfer), occurrence tetap dicatat di DB sebagai metadata; pengguna email tetap ke Postgres.
- Dashboard cache di-invalidate (`invalidateDashboardCache`) setiap occurrence tercatat, sehingga ringkasan langsung ikut ter-update.

### Catatan
- Kontribusi tabungan (savingsGoalId) untuk pengguna Sheets di-skip pada auto-record karena memerlukan FK ke transaksi DB; transaksinya tetap tercatat di Sheets.

## [1.13.3] — 2026-06-01

### Added
- **Peringatan Budget di dashboard.** Kartu peringatan muncul otomatis saat pengeluaran kategori mendekati (≥80%, warn) atau melewati (≥100%, over) budget efektif (budget + rollover). Helper murni `lib/budget-alerts.ts` (+ 10 unit test) + `components/dashboard/BudgetAlertCard.tsx`. Memakai data budget yang sudah ada (tanpa API baru); spending sudah bebas transfer/equity.

### Changed
- **AI Analyst tahan gangguan.** Panggilan Groq di `/api/analyst` dibungkus terpisah — bila gagal, insight deterministik (health score, breakdown kategori, top expenses, rekomendasi otomatis) tetap dikembalikan dengan flag `aiUnavailable`, bukan men-500-kan seluruh response. UI menampilkan notice dan menyembunyikan section narasi AI yang kosong.

### Performance
- **Dashboard lebih cepat (LCP).** Greeting/sapaan + tanggal kini dirender server-side di luar Suspense sebagai elemen LCP yang tercat instan, tidak lagi menunggu fetch data dashboard. `DashboardGreeting` diramping jadi action bar.
- **Hapus font Lora yang tidak terpakai** — `--font-serif` didefinisikan tapi tak pernah dipakai; 4 file font tidak lagi diunduh tiap page load.

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
