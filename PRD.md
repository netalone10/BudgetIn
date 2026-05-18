# PRD — BudgetIn

**Product Version**: 1.8.0
**Document Version**: 1.0.0
**Status**: Production / Active Development
**Last Updated**: May 2026
**Primary Language**: Bahasa Indonesia
**Live URL**: https://budget.amuharr.com

---

## 1. Ringkasan Produk

BudgetIn adalah aplikasi personal finance berbasis web untuk membantu pengguna Indonesia mencatat transaksi, mengelola akun/dompet, memantau budget, menabung menuju goal, mengatur tagihan rutin, dan membaca insight keuangan dengan bantuan AI.

Produk berfokus pada pencatatan yang cepat melalui natural language prompt seperti `beli makan siang 35rb dari BCA`, tetapi tetap menyediakan form manual untuk kasus yang butuh kontrol detail.

**Tagline**: Catat pengeluaran, pahami uangmu — cukup dengan ketik.

---

## 2. Problem Statement

Pengguna personal finance sering gagal konsisten mencatat keuangan karena:

- **Input terlalu lambat**: Form tradisional mengharuskan pilih tanggal, kategori, akun, nominal, dan catatan secara manual.
- **Tidak ada konteks akun**: Banyak pencatat hanya melihat transaksi, bukan saldo per dompet, kartu kredit, atau net worth.
- **Budget tidak actionable**: Budget sering terpisah dari transaksi aktual dan tidak memberi status berjalan.
- **Sulit membaca pola**: Pengguna perlu bantuan untuk memahami cashflow, kategori boros, dan anomali.
- **Kepercayaan data**: Sebagian pengguna ingin data tersimpan di Google Sheets miliknya sendiri, sebagian lain ingin pengalaman database yang lebih simpel.

BudgetIn menyelesaikan ini dengan kombinasi prompt AI, ledger akun, budget bulanan, analisis, dan dual storage.

---

## 3. Target Pengguna

- **Pekerja muda dan mahasiswa Indonesia** yang ingin tracking keuangan tanpa spreadsheet manual.
- **Pengguna Google Sheets** yang ingin data tetap ada di file milik sendiri.
- **Pengguna non-teknis** yang ingin pengalaman seperti chat/prompt.
- **Pengguna yang memiliki banyak akun** seperti cash, bank, e-wallet, tabungan, dan kartu kredit.
- **Pengguna yang ingin budgeting ringan** tanpa kompleksitas aplikasi akuntansi penuh.

---

## 4. Tujuan Produk

### 4.1 Tujuan Utama

- Mempercepat pencatatan transaksi harian.
- Membuat saldo akun dan cashflow mudah dipantau.
- Memberikan kontrol budget bulanan per kategori.
- Membantu pengguna menabung dengan target yang jelas.
- Mengingatkan dan mencatat tagihan rutin.
- Menyediakan insight AI yang tetap berbasis angka deterministik.

### 4.2 Non-Goals Saat Ini

- Tidak menjadi aplikasi akuntansi bisnis penuh.
- Tidak menyediakan mobile app native.
- Tidak mendukung multi-currency conversion otomatis.
- Tidak mendukung multi-user household/shared wallet.
- Tidak menyediakan sinkronisasi bank otomatis.
- Tidak menggantikan financial advisor profesional.

---

## 5. Success Metrics

- **Activation**: pengguna berhasil membuat akun dan mencatat transaksi pertama.
- **Retention**: pengguna kembali mencatat transaksi dalam 7 dan 30 hari.
- **Engagement**: jumlah transaksi prompt/manual per pengguna per bulan.
- **Budget adoption**: persentase pengguna aktif yang membuat budget bulanan.
- **Account coverage**: persentase pengguna yang membuat lebih dari satu akun/dompet.
- **AI utility**: penggunaan prompt laporan, analyst, atau prediction.
- **Data safety**: keberhasilan backup/restore dan minim error storage Google Sheets.

---

## 6. Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | Next.js 16 App Router |
| Language | TypeScript 5 |
| UI | React 19, TailwindCSS 4, shadcn/ui, Base UI, Lucide |
| Auth | NextAuth.js 4, Google OAuth, Credentials |
| Database | PostgreSQL via Prisma 6 |
| AI | Groq SDK, LLaMA 3.1 8B Instant |
| Sheets Storage | Google Sheets API v4 |
| Email | Resend |
| CAPTCHA | Cloudflare Turnstile untuk credentials login |
| Hosting | Vercel |
| Timezone | Asia/Jakarta |
| Testing | Jest, ts-jest, fast-check |

---

## 7. Arsitektur Produk

### 7.1 Storage Model

BudgetIn memakai model storage hybrid:

```text
Email/password user
  → transaksi utama di PostgreSQL
  → akun, budget, kategori, savings, bills di PostgreSQL

Google OAuth user
  → transaksi/account/budget tertentu dapat dibaca/tulis ke Google Sheets
  → metadata penting tetap ada di PostgreSQL
  → fallback/migration flow tersedia saat izin Google belum lengkap
```

### 7.2 Data Flow Prompt

```text
User mengetik prompt
  → POST /api/record
  → ambil akun + kategori user
  → Groq classifyIntent
  → deterministic post-processing
  → dispatch intent handler
  → tulis ke DB atau Sheets sesuai user/storage
  → refresh dashboard, budget, akun
```

### 7.3 Prinsip Ledger

- Saldo akun dihitung dari transaksi ledger, bukan angka manual semata.
- Transfer DB menggunakan dua baris: `transfer_out` dan `transfer_in`.
- Transfer Sheets menggunakan satu baris `Transfer` dengan metadata akun asal/tujuan.
- Transfer principal tidak dihitung sebagai expense.
- Fee transfer dicatat sebagai expense kategori `Biaya Admin`.
- Expense/income boleh bernilai negatif untuk koreksi/refund/reversal.
- Transfer harus positif.
- Waktu transaksi disimpan terpisah sebagai `date` (`YYYY-MM-DD`) dan `time` (`HH:mm`).

---

## 8. Role dan Hak Akses

| Role | Deskripsi | Akses |
|---|---|---|
| Public visitor | Belum login | Landing, About, Contact, Privacy, Terms, Auth |
| Authenticated user | Pengguna biasa | Dashboard dan seluruh fitur finansial miliknya |
| Admin | Email masuk allowlist admin | Admin command center dan aksi operasional user |
| Demo account | Akun publik demo | Akses cepat tanpa CAPTCHA, dibatasi pada kebijakan demo |

---

## 9. Halaman Produk

### 9.1 Public Pages

| Route | Fungsi |
|---|---|
| `/` | Landing page, hero, benefit, CTA |
| `/about` | Penjelasan produk |
| `/contact` | Kontak |
| `/privacy` | Kebijakan privasi |
| `/terms` | Syarat penggunaan |
| `/auth` | Login/register |
| `/auth/error` | Error OAuth/Google permission |

### 9.2 Protected Dashboard

| Route | Fungsi |
|---|---|
| `/dashboard` | Prompt utama, ringkasan hari ini, riwayat transaksi, budget ringkas |
| `/dashboard/accounts` | Daftar akun/dompet, saldo, net worth |
| `/dashboard/accounts/[accountId]` | Detail akun, transaksi akun, tambah transaksi akun |
| `/dashboard/budget` | Budget bulanan, rollover, progress kategori |
| `/dashboard/cashflow` | Analisis cashflow periode |
| `/dashboard/savings` | Savings goals dan progress kontribusi |
| `/dashboard/bills` | Tagihan rutin, pay/skip, summary |
| `/dashboard/calendar` | Kalender transaksi |
| `/dashboard/analyst` | AI financial analyst |
| `/dashboard/panduan` | Panduan penggunaan |
| `/dashboard/changelog` | Update produksi dan link rilis |
| `/dashboard/settings/account` | Reset data, reset akun, delete account |
| `/dashboard/settings/account-types` | Kelola tipe akun |
| `/dashboard/settings/backup-restore` | Export, preview, restore backup JSON |

### 9.3 Admin

| Route | Fungsi |
|---|---|
| `/admin` | Admin command center, KPI, user table, actions |

---

## 10. Core Feature Requirements

### 10.1 Natural Language Transaction Input

Pengguna dapat mencatat transaksi dari prompt berbahasa Indonesia.

**Contoh prompt**:

- `beli makan siang 35rb dari BCA`
- `gaji 8jt masuk ke BNI`
- `transfer 1jt dari BCA ke Jago fee 2500`
- `isi bensin 150rb lalu tol 23rb dari BCA`
- `budget makan 1.2jt bulan ini`
- `tabungan liburan 750rb ke Jago`
- `rekap bulan ini`

**Intent yang didukung**:

| Intent | Fungsi |
|---|---|
| `transaksi` | Expense tunggal |
| `transaksi_bulk` | Beberapa expense dari satu prompt |
| `pemasukan` | Income |
| `transfer` | Transfer antar akun dengan optional fee |
| `budget_setting` | Set/update budget kategori |
| `laporan` | Laporan ringkas berbasis transaksi |
| `unknown` | Klarifikasi jika prompt ambigu |

**Aturan nominal**:

- Mendukung `rb`, `ribu`, `k`, `jt`, `juta`.
- Validasi unit non-moneter agar prompt seperti jumlah barang tidak salah dibaca sebagai uang.
- Koreksi post-processing untuk kasus nominal 1000x off.
- Expense/income dapat negatif untuk koreksi, refund, return, dan reversal.

**Aturan waktu**:

- Jika prompt menyebut tanggal relatif, sistem infer tanggal berdasarkan WIB.
- Jika prompt menyebut jam eksplisit, sistem simpan `time`.
- Jika hanya ada kata seperti pagi/siang/sore/malam tanpa jam eksplisit, sistem memakai waktu submit/current Jakarta time.
- Legacy/missing time dinormalisasi ke `00:00`.

### 10.2 Manual Transaction Entry

Pengguna dapat membuat transaksi via modal/form manual.

**Jenis transaksi**:

- Expense
- Income
- Transfer

**Field utama**:

- Tanggal
- Waktu
- Nominal
- Kategori
- Akun sumber/tujuan
- Catatan
- Fee transfer jika transfer

### 10.3 Transaction Management

Pengguna dapat:

- Melihat transaksi berdasarkan periode.
- Mengedit transaksi.
- Menghapus transaksi.
- Melihat maksimal 200 transaksi per fetch periode.
- Melihat transaksi dengan pagination 10/20/50.
- Melihat transaksi per akun.
- Melihat transaksi dalam kalender.

### 10.4 Account & Wallet Management

Pengguna dapat mengelola akun/dompet seperti cash, bank, e-wallet, tabungan, dan kartu kredit.

**Kemampuan utama**:

- Tambah/edit akun.
- Set tipe akun.
- Set klasifikasi `asset` atau `liability`.
- Nonaktifkan akun tanpa menghapus histori.
- Koreksi saldo akun.
- Lihat net worth.
- Lihat riwayat saldo/net worth.
- Kartu kredit memiliki tanggal settlement dan tanggal jatuh tempo.

### 10.5 Account Types

Pengguna dapat mengelola tipe akun.

**Requirement**:

- Tipe akun memiliki nama, icon, warna, sort order, status aktif.
- Tipe akun memiliki classification: `asset` atau `liability`.
- Tipe inactive tidak ditawarkan untuk akun baru, tetapi tetap bisa dipertahankan saat edit akun lama.
- Perubahan tipe akun harus menjaga validasi kartu kredit.

### 10.6 Budget Tracking

Budget ditetapkan per kategori dan bulan.

**Kemampuan utama**:

- Set/update budget via prompt atau halaman budget.
- Lihat realisasi spending per kategori.
- Lihat sisa budget.
- Lihat kategori unbudgeted.
- Rollover budget untuk kategori tertentu.
- Budget memakai format bulan `YYYY-MM`.
- Transfer principal dikecualikan dari expense budget.

### 10.7 Cashflow

Cashflow membantu pengguna memahami pemasukan, pengeluaran, dan net flow.

**Requirement**:

- Mendukung periode umum dan custom range.
- Menampilkan income, expense, dan net.
- Breakdown per kategori.
- Menggunakan helper klasifikasi transaksi agar transfer tidak dihitung sebagai expense.

### 10.8 Savings Goals

Pengguna dapat membuat target tabungan.

**Kemampuan utama**:

- Buat goal dengan target amount dan optional deadline.
- Progress goal dihitung dari `SavingsContribution`.
- Prompt tabungan otomatis dialokasikan jika hanya ada satu goal.
- Jika ada banyak goal dan prompt ambigu, UI menampilkan pilihan goal.
- Transaksi `Tabungan` tanpa kontribusi eksplisit tidak otomatis menambah progress goal tertentu.

### 10.9 Recurring Bills

Pengguna dapat mengelola tagihan rutin.

**Kemampuan utama**:

- Buat tagihan dengan nama, nominal, due day, kategori, akun, reminder days, dan note.
- Lihat daftar tagihan aktif.
- Tandai tagihan sebagai paid.
- Skip tagihan.
- Summary tagihan.
- Auto-record didukung pada model dan endpoint.
- Cron endpoint tersedia untuk proses tagihan terjadwal.

### 10.10 AI Analyst & Prediction

BudgetIn menyediakan analisis AI yang tetap dikontrol angka server-side.

**AI Analyst**:

- Menghitung health score secara deterministik.
- Menghitung over-budget dan kategori terbesar server-side.
- AI hanya membuat narasi, anomali, dan rekomendasi berbasis data yang sudah disediakan.

**Prediction**:

- Memberikan prediksi/forecast spending berdasarkan data transaksi.
- Harus mengecualikan transfer principal dari expense.

### 10.11 Backup & Restore

Pengguna dapat memindahkan data antar storage melalui backup JSON.

**Kemampuan utama**:

- Export backup JSON.
- Preview backup sebelum restore.
- Restore ke target storage yang sesuai.
- Backup tidak menyimpan secrets.
- Data yang dinormalisasi mencakup kategori, account types, akun, transaksi, budget, savings, kontribusi, tagihan, dan pembayaran tagihan.

### 10.12 Google Setup & Migration Recovery

Google OAuth user membutuhkan izin Google Sheets dan Drive File.

**Requirement**:

- Jika permission tidak lengkap, login diarahkan ke recovery/error flow.
- Jika Sheet gagal dibuat atau belum lengkap, dashboard menampilkan recovery UI.
- Jika ada data fallback DB dan target Sheets sudah sesuai, user dapat menandai migration complete.
- Data fallback tidak boleh hilang otomatis.

### 10.13 Account Data Controls

Pengguna dapat mengelola data akunnya sendiri.

**Aksi**:

- Reset Data: hapus data finansial dan reseed default.
- Reset Akun: reset koneksi/setup akun.
- Delete Account: hapus akun user.

**Safety**:

- Aksi destruktif memakai confirmation phrase.
- Akun demo publik dibatasi dari aksi destruktif.

### 10.14 Admin Command Center

Admin dapat memantau dan mengelola user.

**KPI**:

- Total user.
- Verified/unverified email users.
- Google/DB/google setup required split.
- Active users 7/30 hari.
- Jumlah akun, savings goals, recurring bills.

**User management**:

- Search user.
- Filter provider, verified status, data mode.
- Sort dan pagination.
- Resend verification.
- Reset password.
- Delete user.

---

## 11. API Surface

### 11.1 Auth

| Method | Endpoint | Fungsi |
|---|---|---|
| GET/POST | `/api/auth/[...nextauth]` | NextAuth handler |
| POST | `/api/auth/register` | Register email/password |
| POST | `/api/auth/resend-verification` | Kirim ulang verifikasi |
| GET | `/api/auth/verify` | Verifikasi auth terkait |
| GET | `/api/verify-email` | Verifikasi email token |

### 11.2 Transactions

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/record` | Ambil transaksi by period/custom range |
| POST | `/api/record` | Prompt NLP |
| PATCH/DELETE | `/api/record/[recordId]` | Edit/hapus transaksi |
| POST | `/api/transactions/manual` | Input manual |
| GET | `/api/transactions/calendar` | Data kalender |

### 11.3 Accounts

| Method | Endpoint | Fungsi |
|---|---|---|
| GET/POST | `/api/accounts` | List/create akun |
| PATCH/DELETE | `/api/accounts/[accountId]` | Update/nonaktif akun |
| POST | `/api/accounts/[accountId]/adjust` | Koreksi saldo |
| GET | `/api/accounts/[accountId]/transactions` | Riwayat akun |
| GET | `/api/accounts/networth-history` | Riwayat net worth |

### 11.4 Account Types

| Method | Endpoint | Fungsi |
|---|---|---|
| GET/POST | `/api/account-types` | List/create tipe akun |
| PATCH/DELETE | `/api/account-types/[typeId]` | Update/nonaktif tipe akun |

### 11.5 Budget & Categories

| Method | Endpoint | Fungsi |
|---|---|---|
| GET/POST | `/api/budget` | Ambil/set budget |
| PATCH/DELETE | `/api/budget/[id]` | Update/delete budget |
| POST | `/api/budget/rollover` | Rollover budget |
| GET/POST | `/api/categories` | List/create kategori |
| PATCH/DELETE | `/api/categories/[categoryId]` | Update/delete kategori |

### 11.6 Savings

| Method | Endpoint | Fungsi |
|---|---|---|
| GET/POST | `/api/savings` | List/create savings goal |
| PATCH/DELETE | `/api/savings/[goalId]` | Update/delete savings goal |

### 11.7 Bills

| Method | Endpoint | Fungsi |
|---|---|---|
| GET/POST | `/api/bills` | List/create recurring bills |
| PATCH/DELETE | `/api/bills/[id]` | Update/delete bill |
| POST | `/api/bills/[id]/pay` | Tandai paid |
| POST | `/api/bills/[id]/skip` | Skip periode |
| GET | `/api/bills/summary` | Ringkasan tagihan |
| GET/POST | `/api/cron/bills` | Proses terjadwal tagihan |

### 11.8 Insights

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/cashflow` | Data cashflow |
| GET | `/api/analyst` | AI analyst |
| GET | `/api/prediction` | Forecast/prediction |

### 11.9 Backup, User, Admin

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/backup/export` | Export backup JSON |
| POST | `/api/backup/preview` | Preview restore |
| POST | `/api/backup/restore` | Restore backup |
| GET/PUT | `/api/user` | Profile user |
| PATCH | `/api/user/password` | Ganti password |
| POST | `/api/user/reset-data` | Reset data finansial |
| POST | `/api/user/reset-account` | Reset akun/setup |
| DELETE | `/api/user/account` | Delete account |
| GET | `/api/google-setup-migration` | Preview migration Google setup |
| POST | `/api/google-setup-migration` | Execute/mark complete migration |
| GET | `/api/admin/stats` | KPI admin |
| GET | `/api/admin/users` | List/search/filter users |
| DELETE/POST | `/api/admin/users/[userId]` | User actions |

---

## 12. Data Model

### 12.1 PostgreSQL Models

| Model | Fungsi |
|---|---|
| `User` | Identitas auth, token Google, `sheetsId`, email verification, migration marker |
| `Category` | Kategori expense/income, savings flag, rollover flag |
| `Budget` | Budget per kategori per bulan |
| `Transaction` | Ledger transaksi DB, termasuk time, account, transferId, initial balance |
| `AccountType` | Tipe akun per user dengan klasifikasi asset/liability |
| `Account` | Akun/dompet user dan metadata kartu kredit |
| `SavingsGoal` | Target tabungan |
| `SavingsContribution` | Kontribusi goal yang terhubung transaksi |
| `RecurringBill` | Definisi tagihan rutin |
| `BillPayment` | Pembayaran tagihan per bulan |

### 12.2 Google Sheets Schema

Google Sheets digunakan untuk storage pengguna OAuth. Sheet utama mencakup:

- `Transaksi`
- `Budget`
- `Akun`

Schema transaksi Google Sheets bersifat append-only compatible. Kolom waktu ditambahkan tanpa mengubah posisi kolom lama.

---

## 13. Default Data

### 13.1 Default Categories

Kategori default di-seed saat onboarding atau reset data.

**Expense examples**:

- Makan
- Transport
- Tagihan
- Kesehatan
- Hiburan
- Belanja
- Pendidikan
- Lain-Lain
- Biaya Admin
- Tabungan

**Income examples**:

- Gaji
- Freelance
- Bonus
- Investasi
- Bisnis
- THR
- Dividen
- Lainnya

### 13.2 Default Account Types

Default account types mendukung klasifikasi asset/liability, seperti kas, bank, e-wallet, tabungan, dan kartu kredit.

---

## 14. Integrasi Eksternal

| Service | Fungsi |
|---|---|
| Groq | Intent classification, laporan, analyst, prediction |
| Google OAuth | Login dan akses scopes |
| Google Sheets API | Storage transaksi/akun/budget untuk Google users |
| PostgreSQL | Storage relational utama |
| Resend | Verification dan reset password email |
| Cloudflare Turnstile | CAPTCHA credentials flow |
| Vercel | Hosting, analytics, speed insights |

---

## 15. Security, Privacy, and Reliability

### 15.1 Security Requirements

- Password disimpan sebagai bcrypt hash.
- Email/password login wajib email verified.
- Credentials login dilindungi Turnstile, kecuali demo account.
- Google login wajib scope `drive.file`.
- Admin guard dilakukan server-side.
- Backup JSON tidak boleh menyimpan secrets/token.
- Aksi destruktif user memakai konfirmasi eksplisit.

### 15.2 Privacy Requirements

- Data finansial user hanya boleh diakses oleh session user terkait.
- Google Sheets milik user digunakan hanya sesuai scope yang diberikan.
- Admin tooling harus minim akses data sensitif dan fokus operasional.

### 15.3 Reliability Requirements

- Google token expired/revoked harus menghasilkan pesan re-auth yang jelas.
- Dual storage path harus menjaga perilaku transaksi konsisten.
- AI tidak boleh menjadi sumber kebenaran angka finansial.
- Aggregation wajib memakai helper klasifikasi transaksi untuk menghindari salah hitung transfer.

---

## 16. Environment Variables

```env
DATABASE_URL=
DIRECT_URL=

NEXTAUTH_URL=
NEXTAUTH_SECRET=
NEXT_PUBLIC_APP_URL=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

GROQ_API_KEY_1=
GROQ_API_KEY_2=
GROQ_API_KEY=

RESEND_API_KEY=

TURNSTILE_SECRET_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
```

---

## 17. Feature Status

| Feature | Status |
|---|---|
| Landing/public pages | Done |
| SEO metadata, robots, sitemap, OG/Twitter images | Done |
| Google OAuth + Sheets onboarding | Done |
| Email/password auth + verification | Done |
| Cloudflare Turnstile credentials flow | Done |
| NLP transaction input | Done |
| Bulk transaction prompt | Done |
| Manual transaction form | Done |
| Transaction time support | Done |
| Negative expense/income corrections | Done |
| Transfer antar akun | Done |
| Transfer fee | Done |
| Account/dompet management | Done |
| Account type management | Done |
| Kartu kredit billing metadata | Done |
| Budget tracking | Done |
| Budget rollover | Done |
| Cashflow page | Done |
| Calendar transaction view | Done |
| Savings goals + contribution allocation | Done |
| Recurring bills | Done |
| AI analyst | Done |
| Prediction/forecast | Done |
| Backup/restore JSON | Done |
| Google setup migration/recovery | Done |
| Account reset/delete controls | Done |
| Admin command center | Done |
| Production changelog page | Done |
| Native mobile app | Not planned |
| Bank auto-sync | Not planned |
| Multi-user shared wallet | Not planned |
| User-configurable timezone | Backlog |
| Multi-language UI | Backlog |

---

## 18. Known Constraints & Risks

- **Timezone**: aplikasi menggunakan Asia/Jakarta.
- **Dual storage**: DB dan Sheets path harus dijaga konsisten.
- **Transfer representation**: DB dan Sheets memodelkan transfer secara berbeda.
- **Google dependency**: user Sheets bergantung pada token, permission, dan API Google.
- **AI dependency**: prompt/analyst/prediction bergantung pada Groq.
- **No bank sync**: semua data transaksi berasal dari input user, Google Sheets, atau restore backup.
- **Admin allowlist**: akses admin berbasis daftar email di kode.
- **Lint caveat**: script `npm run lint` saat ini bermasalah dengan Next CLI; validasi utama memakai `npx tsc --noEmit` dan focused Jest.

---

## 19. Validation Strategy

### 19.1 Automated Validation

- Typecheck: `npx tsc --noEmit`
- Unit/focused tests: `npx jest <test files> --runInBand`
- Property tests untuk accounting/amount/savings bila menyentuh logic terkait.

### 19.2 High-Risk Regression Areas

- Transfer exclusion dari expense.
- Signed amount pada refund/koreksi.
- Savings contribution allocation.
- Account balance/net worth.
- Google Sheets compatibility.
- Transaction date/time sorting.
- Account type active/inactive edge cases.
- Google setup migration flow.

---

## 20. Roadmap Kandidat

### Near-Term

- Tambah test coverage untuk bills dan backup/restore.
- Perbaiki script lint agar kompatibel dengan Next.js saat ini.
- Tambahkan rate limiting untuk endpoint AI/prompt.
- Perjelas UX recovery Google token expired.

### Mid-Term

- User-configurable timezone.
- Export PDF/CSV dari dashboard/analyst.
- Budget templates.
- Custom recurring transaction automation yang lebih fleksibel.
- Alert budget mendekati limit.

### Long-Term

- Multi-language support.
- Shared household budget.
- Bank/e-wallet statement import.
- Native mobile atau PWA offline-first.

---

## 21. Referensi Dokumen Internal

- `SYSTEM_MAP.md` — peta modul, data flow, dan risiko teknis.
- `lib/changelog.ts` — daftar production release.
- `prisma/schema.prisma` — model data aktual.
- `Budgetinv2.md` — catatan/ide produk versi sebelumnya jika masih relevan.
