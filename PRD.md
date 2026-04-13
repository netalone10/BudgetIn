# PRD — BudgetIn

**Version**: 0.1.0  
**Status**: Active Development  
**Last Updated**: April 2026  
**Language**: Indonesian (all UI, prompts, copy)  
**Live**: https://budget.amuharr.com

---

## 1. Overview

BudgetIn adalah AI-powered personal finance tracker. User catat pengeluaran/pemasukan lewat natural language, app auto-kategorisasi + simpan ke storage, dan kasih budget tracking dengan analisis keuangan bulanan.

**Tagline**: "Catat pengeluaran, pahami uangmu — cukup dengan ketik"

---

## 2. Problem Statement

Kebanyakan orang malas catat keuangan karena:
- Form entry tradisional ribet (pilih kategori, masukkan tanggal, dll)
- Tidak ada konteks realtime vs budget
- Tidak ada insight actionable

**BudgetIn solves**: Natural language input ("makan siang 35rb") → otomatis tersimpan, terkategorisasi, terbudget.

---

## 3. Target Users

- Mahasiswa / pekerja muda Indonesia
- Pengguna yang paham Google Sheets tapi malas input manual
- Pengguna yang mau tracking keuangan tanpa aplikasi yang kompleks

---

## 4. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | TailwindCSS 4 + shadcn/ui + Base UI |
| Auth | NextAuth.js 4 (Google OAuth + Credentials) |
| Database | PostgreSQL via Prisma 6 (Supabase) |
| AI/NLP | Groq SDK (LLaMA 3.1 8B Instant) |
| Storage (OAuth) | Google Sheets API v4 |
| Email | Resend SDK |
| Hosting | Vercel |
| Timezone | Asia/Jakarta (WIB, hardcoded) |

---

## 5. Architecture

### Dual Storage Model

User type menentukan storage:

```
Google OAuth user  → transaksi di Google Sheets ("Catatuang - {name}")
Email/Password user → transaksi di PostgreSQL
```

Budget + kategori → selalu di PostgreSQL (untuk UI dropdown + budget tab).

### Data Flow

```
User input (NLP)
  → POST /api/record
    → Groq intent classification
      → transaksi / pemasukan → save ke Sheets atau DB
      → budget_setting         → save ke DB (Budget table)
      → laporan                → fetch data → Groq summary → return
      → unknown                → return clarification
```

---

## 6. Pages & Routes

### Public
| Route | Description |
|-------|-------------|
| `/` | Landing page — hero, feature grid, CTA ke /auth |
| `/auth` | Login + Register (tab), Google OAuth button |
| `/privacy` | Halaman privasi (static) |
| `/terms` | Syarat penggunaan (static) |
| `/auth/error` | OAuth error handler |

### Protected (session required)
| Route | Description |
|-------|-------------|
| `/dashboard` | Main app — prompt input, transaction table, budget tabs |
| `/admin` | Admin panel — stats + user management |

---

## 7. API Endpoints

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register email user, send verification email |
| GET | `/api/auth/[...nextauth]` | NextAuth handler (Google + Credentials) |
| GET | `/api/verify-email?token=` | Verifikasi token email |
| POST | `/api/auth/resend-verification` | Resend link verifikasi (rate limit 5 menit) |

### Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/record?period=bulan+ini` | Fetch transaksi by period |
| POST | `/api/record` | Submit NLP prompt → parse → save |
| PATCH | `/api/record/[recordId]` | Edit transaksi |
| DELETE | `/api/record/[recordId]` | Hapus transaksi |

### Budget & Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/budget` | Ambil budgets + spent + unbudgeted bulan ini |
| POST | `/api/budget` | Set/update budget kategori |
| GET | `/api/categories` | List semua kategori user |

### User

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user` | Profile user |
| PUT | `/api/user` | Update nama |
| PATCH | `/api/user/password` | Ganti password (email users only) |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Stats + 20 recent users |
| DELETE | `/api/admin/users/[userId]` | Hapus user + cascade data |
| POST | `/api/admin/users/[userId]?action=reset-password` | Reset password → send email |
| POST | `/api/admin/users/[userId]?action=resend-verification` | Resend verifikasi email |

---

## 8. Feature Specs

### 8.1 NLP Input (Core Feature)

**Model**: Groq LLaMA 3.1 8B Instant  
**Mode**: JSON response_format, temperature=0.1

**Supported Intents**:

| Intent | Trigger Examples | Output |
|--------|-----------------|--------|
| `transaksi` | "makan siang 35rb", "bayar kos 1.3jt" | amount, category, note, date |
| `pemasukan` | "gajian 5jt", "freelance dapat 2jt" | incomeAmount, incomeCategory, note, date |
| `budget_setting` | "budget makan 500rb" | budgetCategory, budgetAmount |
| `laporan` | "rekap bulan ini", "analisis pengeluaran" | totalSpent, spentByCategory, AI summary |
| `unknown` | Ambigu / non-monetary | clarification message |

**Nominal Parsing**:
- `rb` / `ribu` = ×1.000
- `jt` / `juta` = ×1.000.000
- `k` = ×1.000
- Post-processing cross-check: jika AI output ~1000× off dari raw prompt → koreksi otomatis

**Unit Validation**:
- Input non-monetary (kg, pcs, ekor, lot, dll) tanpa nominal IDR → reject dengan pesan helpful
- Exception: "dapat emas senilai 3jt" → valid (ada nominal IDR)

**Groq Key Rotation**:
- Load dari env: `GROQ_API_KEY_1`, `GROQ_API_KEY_2`, ...
- Fallback ke `GROQ_API_KEY` (legacy)
- On 429 → try next key

**Auto-categorization** (expense):
- Makan/kafe/resto → "Makan"
- Grab/Gojek/bensin → "Transport"
- Netflix/game → "Hiburan"
- Kos/sewa → "Kos"
- Listrik/tagihan → "Tagihan"
- Obat/dokter → "Kesehatan"
- Prioritizes user's existing categories

**Date Inference** (WIB):
- "kemarin" → yesterday
- "tadi pagi" / "barusan" → today
- "minggu lalu" → 7 days ago

### 8.2 Budget Tracking

**Set Budget**: Ketik "Budget makan 500rb" → intent `budget_setting` → POST `/api/budget`

**Fixed vs Variable**:
- **Fixed** (kos, sewa, arisan, cicilan, kredit, kontrak, asuransi, bpjs, langganan): prorated = 100% budget
- **Variable** (semua lainnya): prorated = `(dayOfMonth / totalDays) × budget`

**vs Budget Tab**:
- Kolom: Kategori | Budget | Prorated | Realisasi | Sisa
- Color: hijau (0–79%) → kuning (80–99%) → merah (≥100%)
- Mini progress bar per row
- **Unbudgeted section**: Tampilkan spending pada kategori tanpa budget
- Footer: total pengeluaran vs total sisa

### 8.3 Transaction Management

**CRUD**:
- Create via NLP prompt
- Read by period (hari ini, minggu ini, bulan ini, bulan lalu, custom date range)
- Update inline di table (date, amount, category, note)
- Delete dengan konfirmasi

**Pagination**: 10 / 20 / 50 rows per page, "X–Y dari Z" indicator

**Max records returned**: 200 per period fetch

### 8.4 Cashflow Tab

- Periode selector: today, week, month, custom
- Metric cards: +Pemasukan, -Pengeluaran, =Net
- Per-kategori breakdown dengan collapsible transaction list

### 8.5 AI Report (laporan intent)

Process:
1. Fetch transaksi period
2. Aggregate by category
3. Compare vs budgets
4. Second Groq call → generate 3–5 kalimat Indonesia:
   - Kategori terbesar
   - Status budget (over/under)
   - 1 saran actionable

Output di `ReportView` component:
- Total amount (large, bold)
- Per-kategori: dot color (hijau/kuning/merah) + nominal vs budget
- AI summary dalam box (italic, muted)

### 8.6 Auth Flows

**Google OAuth**:
1. Consent screen → Google returns access_token (drive + sheets scopes)
2. Upsert user by googleId
3. First login: buat Google Sheet "Catatuang - {name}", seed 16 default categories
4. Session: userId, sheetsId, accessToken, isAdmin

**Email/Password**:
1. Register → hash bcrypt (salt=12) → send verification email (Resend, expiry 24h)
2. Show "Cek email kamu!" screen + resend button (rate limit 5 menit)
3. Click link → verify token → emailVerified = now → redirect `/auth?verified=true`
4. Login: cek emailVerified, jika null → block + show resend screen

**Password Change** (email users only): current password + new password + confirm → PATCH `/api/user/password`

### 8.7 Admin Panel

**Access**: isAdmin check server-side (email list di `/lib/is-admin.ts`)

**Stats cards** (6):
1. Total Users
2. Via Google
3. Via Email
4. New This Month + "X minggu ini"
5. Total Transactions (DB only)
6. Budget Aktif

**User Table**:
- Columns: Nama, Email, Type (Google/Email badge), Verified status, Budget count, Signup date
- Actions: Resend Verification (email+unverified), Reset Password (email only), Delete (not self)
- Confirm dialog before destructive actions
- Toast feedback

---

## 9. Data Models

### PostgreSQL (Prisma)

**users**
```
id, google_id, email, name, image, password (bcrypt),
access_token, refresh_token, token_expiry, sheets_id,
email_verified, verification_token, verification_token_expiry,
created_at
```

**categories**
```
id, user_id (FK), name
Unique: (user_id, name)
```

**budgets**
```
id, user_id (FK), category_id (FK), amount, month (YYYY-MM)
Unique: (user_id, category_id, month)
```

**transactions** (email users only)
```
id, user_id (FK), date (YYYY-MM-DD), amount, category, note, type (expense|income), created_at
```

### Google Sheets (OAuth users)

**Sheet: Transaksi**
```
A: id (UUID)
B: date (YYYY-MM-DD)
C: amount (Number)
D: category (String)
E: note (String)
F: created_at (ISO 8601)
G: type (expense|income)
```

**Sheet: Budget**
```
A: category
B: amount
C: month (YYYY-MM)
```

---

## 10. Default Categories

**Expense** (8): Makan, Transport, Tagihan, Kesehatan, Hiburan, Belanja, Pendidikan, Lain-Lain  
**Income** (8): Gaji, Freelance, Bonus, Investasi, Bisnis, THR, Dividen, Lainnya

Auto-seeded saat user baru (email register atau first Google login).

---

## 11. Email Templates (via Resend)

| Email | Subject | Content |
|-------|---------|---------|
| Verification | "Verifikasi Email BudgetIn" | Link + 24h expiry |
| Password Reset | "Password BudgetIn Kamu Direset" | Temp password (12-char random) + login link |

Sender: `noreply@amuharr.com`

---

## 12. Environment Variables

```env
# Database
DATABASE_URL=postgresql://...pgbouncer   # runtime (pooled)
DIRECT_URL=postgresql://...direct        # migrations

# NextAuth
NEXTAUTH_URL=https://budget.amuharr.com
NEXTAUTH_SECRET=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Groq (AI)
GROQ_API_KEY_1=
GROQ_API_KEY_2=   # optional, rotation fallback
GROQ_API_KEY=     # legacy fallback

# Email
RESEND_API_KEY=

# App
NEXTAUTH_URL=https://budget.amuharr.com
NEXT_PUBLIC_APP_URL=https://budget.amuharr.com
```

---

## 13. File Structure

```
/app
  /api
    /auth/[...nextauth]   NextAuth handler
    /auth/register        Email registration
    /verify-email         Token verification
    /record               Transactions CRUD + NLP
    /budget               Budget CRUD
    /categories           Category list
    /user                 Profile + password
    /admin                Stats + user management
  /dashboard              Main protected page
  /auth                   Login/register page
  /admin                  Admin panel
  /privacy, /terms        Legal pages
  layout.tsx              Root layout + fonts + Providers
  page.tsx                Landing page

/components
  /ui                     shadcn base components
  Navbar.tsx              Header + user menu dropdown
  DashboardTabs.tsx       Arus Kas + vs Budget tabs
  TransactionCard.tsx     Inline-editable row
  ReportView.tsx          AI report display
  ChangePasswordModal.tsx Password change modal
  BudgetStatus.tsx        Budget summary card
  Providers.tsx           SessionProvider wrapper
  ThemeToggle.tsx         Dark/light toggle

/lib
  auth.ts                 NextAuth config (providers, callbacks)
  prisma.ts               Prisma client singleton
  is-admin.ts             Admin email check
  email.ts                sendVerificationEmail, sendPasswordResetEmail
  utils.ts                cn(), general helpers

/utils
  groq.ts                 Intent classification + key rotation
  sheets.ts               Google Sheets CRUD
  db-transactions.ts      PostgreSQL CRUD
  seed-categories.ts      Default category seeding
  token.ts                Google token refresh

/prisma
  schema.prisma           Data model

/types
  next-auth.d.ts          Session/JWT type augmentation
```

---

## 14. Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| Google OAuth + Sheets | ✓ | Auto-create sheet on first login |
| Email/Password Auth | ✓ | Full verification flow |
| Email verification | ✓ | Resend + rate limit |
| NLP transaction input | ✓ | Groq LLaMA 3.1 8B |
| Budget tracking | ✓ | Fixed/variable prorated logic |
| Income tracking | ✓ | Separate intent |
| Cashflow dashboard | ✓ | By period + category drilldown |
| vs Budget tab | ✓ | Prorated + color coding + unbudgeted section |
| AI report generation | ✓ | Indonesian, actionable |
| Transaction CRUD | ✓ | Inline edit + pagination (10/20/50) |
| Category management | ✓ | Auto-seed 16 defaults |
| Admin panel | ✓ | Stats + user management |
| Dark mode | ✓ | TailwindCSS |
| Responsive design | ✓ | Mobile-first |
| Password change | ✓ | Email users only |
| Admin reset password | ✓ | Via email |
| Success notification auto-dismiss | ✓ | 4 detik |
| Unbudgeted expenses section | ✓ | Budget tab, below main table |
| User-configurable timezone | ✗ | Jakarta hardcoded |
| Transaction export | ✗ | Google Sheets serves as export |
| Recurring transactions | ✗ | Manual only |
| Multi-language | ✗ | Indonesian only |
| Mobile app | ✗ | Web only (responsive) |
| DB migration from Sheets | ✗ | Not planned |

---

## 15. Known Constraints

1. **Timezone hardcoded** Asia/Jakarta — multi-timezone user tidak support
2. **Dual storage**: Email user tidak bisa aktifkan Sheets; Google user tidak bisa migrasi ke DB-only
3. **AI dependency**: Groq API required — tidak ada offline/fallback NLP
4. **Google Sheets limit**: Max 200 records per fetch (sheets API performance)
5. **Admin**: Hardcoded email list, tidak ada UI admin management
6. **Prorated fixed keywords**: Hardcoded list — tidak configurable per user
7. **Rate limit**: Hanya email resend (5 min) — tidak ada rate limit di `/api/record`
