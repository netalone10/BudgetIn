# Project Summary

- **Tujuan**: Aplikasi manajemen keuangan personal berbasis AI — pencatatan transaksi via natural language prompt, budget tracking, tabungan, cashflow, dan analisis keuangan.
- **Tech stack**: Next.js 15 (App Router), TypeScript, NextAuth v4, Prisma ORM, PostgreSQL (Supabase + PgBouncer), Google Sheets API, Groq AI (llama-3.1-8b-instant), Cloudflare Turnstile CAPTCHA.
- **Arsitektur**: Full-stack Next.js monolith — React Server/Client Components + API Routes. Dual storage: Google Sheets (Google OAuth users) vs PostgreSQL (email/password users).

---

# Core Logic Flow (Function-Level Flowchart)

**Pencatatan transaksi (AI prompt):**
```
DashboardPage[handleSubmit] → POST /api/record
  → getServerSession[authOptions]
  → classifyIntent[groq.ts] (Groq llama-3.1-8b-instant, JSON output)
  → resolveAccount() → matchAccount() | createMissingAccount()
  → [Google user] appendTransaction[sheets.ts] + updateAccountBalance[sheets.ts]
  → [Email user] appendTransactionDB[db-transactions.ts] → prisma.transaction.create
  → prisma.category.upsert
```

**Pencatatan manual:**
```
ManualTransactionForm → POST /api/transactions/manual
  → getServerSession
  → prisma.transaction.create (DB) | appendTransaction[sheets.ts] (Sheets)
  → updateAccountBalance (Sheets only)
```

**Baca transaksi:**
```
DashboardPage[fetchTransactions] → GET /api/record?period=
  → [Google user] getValidToken[token.ts] → getTransactions[sheets.ts]
  → [Email user] getTransactionsDB[db-transactions.ts]
```

**Auth flow:**
```
/auth page → NextAuth signIn
  → [Google] signIn callback → prisma.user.upsert → createGoogleSheet[sheets.ts] → seedDefaultCategories
  → [Email] authorize callback → prisma.user.findUnique → bcrypt.compare → verifyTurnstile
  → jwt callback → session callback → JWT cookie
```

**Saldo akun (DB users):**
```
GET /api/accounts → getAccountBalances[account-balance.ts]
  → prisma.account.findMany + prisma.transaction.groupBy (pure ledger)
  → calculateNetWorth
```

**Laporan AI:**
```
DashboardPage → POST /api/record (intent: laporan)
  → getTransactions/getTransactionsDB → prisma.budget.findMany
  → callWithRotation[groq.ts] (llama-3.1-8b-instant, narrative summary)
```

**Analyst (analisis mendalam):**
```
/dashboard/analyst → GET /api/analyst?period=
  → getTransactions/getTransactionsDB
  → callWithRotation[groq.ts] → AI narrative analysis
```

---

# Clean Tree

```
BudgetIn/
├── app/
│   ├── api/
│   │   ├── account-types/         # CRUD account types
│   │   │   ├── route.ts
│   │   │   └── [typeId]/route.ts
│   │   ├── accounts/              # CRUD accounts + balance
│   │   │   ├── route.ts
│   │   │   └── [accountId]/
│   │   │       ├── route.ts
│   │   │       └── adjust/route.ts
│   │   ├── admin/                 # Admin panel API
│   │   │   ├── stats/route.ts
│   │   │   └── users/[userId]/route.ts
│   │   ├── analyst/route.ts       # AI deep analysis
│   │   ├── auth/                  # Email auth
│   │   │   ├── register/route.ts
│   │   │   ├── resend-verification/route.ts
│   │   │   └── verify/route.ts
│   │   ├── budget/                # Budget CRUD
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── cashflow/route.ts      # Cashflow + credit card billing
│   │   ├── categories/            # Category CRUD
│   │   │   ├── route.ts
│   │   │   └── [categoryId]/route.ts
│   │   ├── prediction/route.ts    # AI spending prediction
│   │   ├── record/                # Core: AI transaction input
│   │   │   ├── route.ts
│   │   │   └── [recordId]/route.ts
│   │   ├── savings/               # Savings goals
│   │   │   ├── route.ts
│   │   │   └── [goalId]/route.ts
│   │   ├── transactions/
│   │   │   └── manual/route.ts    # Manual transaction input
│   │   ├── user/
│   │   │   ├── route.ts           # Update profil user
│   │   │   └── password/route.ts  # Ganti password
│   │   └── verify-email/route.ts
│   ├── auth/page.tsx              # Login/register page
│   ├── admin/page.tsx             # Admin panel
│   ├── dashboard/
│   │   ├── page.tsx               # Main dashboard (AI prompt input + tx list)
│   │   ├── layout.tsx             # Sidebar layout
│   │   ├── accounts/page.tsx      # Manajemen akun & net worth
│   │   ├── analyst/page.tsx       # AI financial analyst
│   │   ├── cashflow/page.tsx      # Cashflow & credit card billing
│   │   ├── savings/page.tsx       # Savings goals
│   │   └── settings/
│   │       └── account-types/page.tsx
│   ├── layout.tsx                 # Root layout + Providers
│   └── page.tsx                   # Landing page
├── components/
│   ├── ui/                        # shadcn/ui primitives
│   ├── BudgetStatus.tsx           # Budget chart per kategori
│   ├── DashboardTabs.tsx          # Tab navigasi (Transaksi/Budget/Laporan)
│   ├── ManageCategoriesModal.tsx  # CRUD kategori
│   ├── ManualTransactionForm.tsx  # Form input manual
│   ├── NetWorthSummaryCard.tsx    # Ringkasan aset/liabilitas
│   ├── ReportView.tsx             # Tampilan laporan AI
│   ├── SavingsGoalCard.tsx        # Kartu tabungan goal
│   ├── Sidebar.tsx                # Navigasi sidebar
│   ├── TransactionCard.tsx        # Item transaksi
│   └── Providers.tsx              # SessionProvider + ThemeProvider
├── lib/
│   ├── auth.ts                    # NextAuth config (Google + Credentials)
│   ├── email.ts                   # Nodemailer — kirim email verifikasi
│   ├── is-admin.ts                # Cek apakah email adalah admin
│   ├── prisma.ts                  # Prisma client singleton
│   ├── savings-utils.ts           # Helper: deteksi transaksi savings
│   ├── token-utils.ts             # Generate/verify email token
│   └── turnstile.ts               # Cloudflare Turnstile verifikasi
├── utils/
│   ├── account-balance.ts         # Pure-ledger balance calc (DB users)
│   ├── account-types.ts           # Seed default account types
│   ├── db-transactions.ts         # DB CRUD transaksi (email users)
│   ├── groq.ts                    # Groq AI client + classifyIntent + callWithRotation
│   ├── seed-categories.ts         # Seed kategori default saat onboarding
│   ├── sheets.ts                  # Google Sheets API (CRUD transaksi, akun, budget)
│   └── token.ts                   # Refresh Google OAuth token
├── hooks/
│   └── useTheme.ts
├── prisma/
│   └── schema.prisma              # DB schema
└── .env.local                     # (tidak di-commit)
```

---

# Module Map (The Chapters)

| File | Fungsi/Class Utama | Peran |
|---|---|---|
| `app/api/record/route.ts` | `GET`, `POST` | Inti sistem: baca + simpan transaksi via AI prompt |
| `app/api/transactions/manual/route.ts` | `POST` | Input transaksi manual (form, tanpa AI) |
| `app/api/accounts/route.ts` | `GET`, `POST` | CRUD akun + saldo ledger |
| `app/api/accounts/[accountId]/adjust/route.ts` | `POST` | Adjust saldo paksa (buat transaksi koreksi) |
| `app/api/cashflow/route.ts` | `GET` | Cashflow bulanan + tagihan kartu kredit per billing period |
| `app/api/savings/route.ts` | `GET`, `POST` | CRUD savings goals + progress tracking |
| `app/api/budget/route.ts` | `GET`, `POST` | CRUD budget per kategori per bulan |
| `app/api/analyst/route.ts` | `GET` | AI financial analyst — narasi mendalam |
| `app/api/prediction/route.ts` | `GET` | Prediksi pengeluaran akhir bulan via AI |
| `app/api/auth/register/route.ts` | `POST` | Registrasi email/password + kirim verifikasi |
| `app/dashboard/page.tsx` | `DashboardPage` | Main UI: prompt input, riwayat tx, budget tab |
| `app/dashboard/accounts/page.tsx` | `AccountsPage` | UI manajemen akun + net worth card |
| `app/dashboard/cashflow/page.tsx` | `CashflowPage` | UI cashflow + kartu kredit billing |
| `lib/auth.ts` | `authOptions` | NextAuth config: Google OAuth + email/password |
| `lib/prisma.ts` | `prisma` | Prisma client singleton |
| `utils/groq.ts` | `classifyIntent`, `callWithRotation` | AI intent parser + Groq key rotation |
| `utils/sheets.ts` | `appendTransaction`, `getTransactions`, `updateAccountBalance`, `appendAccount`, `getAccounts`, `createGoogleSheet` | Google Sheets CRUD untuk Google users |
| `utils/db-transactions.ts` | `appendTransactionDB`, `getTransactionsDB`, `updateTransactionDB`, `deleteTransactionDB` | DB CRUD transaksi untuk email users |
| `utils/account-balance.ts` | `getAccountBalances`, `calculateNetWorth`, `getSingleAccountBalance` | Hitung saldo akun dari ledger transaksi |
| `utils/token.ts` | `getValidToken` | Refresh Google OAuth token jika expired |
| `lib/email.ts` | `sendVerificationEmail` | Kirim email verifikasi via Nodemailer |

---

# Data & Config

**Config:**
- `.env.local` — semua secrets (DB, Google OAuth, Groq keys, Turnstile, SMTP)
- `GROQ_API_KEY_1`, `GROQ_API_KEY_2`, ... — rotasi key Groq

**Skema DB (Prisma → PostgreSQL):**
```
User (1) ──── (*) Category
User (1) ──── (*) Budget → Category
User (1) ──── (*) Transaction → Account (nullable)
User (1) ──── (*) SavingsGoal
User (1) ──── (*) AccountType
User (1) ──── (*) Account → AccountType
AccountType (1) ── (*) Account
```

**Tabel utama:**
- `users` — id, email, googleId, sheetsId, password, tokens OAuth
- `transactions` — id, userId, date, amount (Decimal 19,4), category, type, accountId, transferId, isInitialBalance
- `accounts` — id, userId, accountTypeId, name, initialBalance, tanggalSettlement, tanggalJatuhTempo
- `account_types` — id, userId, name, classification (asset/liability)
- `categories` — id, userId, name, type, isSavings
- `budgets` — userId + categoryId + month (unique)
- `savings_goals` — id, userId, name, targetAmount, deadline

**Migration:** `prisma/` (Prisma schema)
**Seed:** `utils/seed-categories.ts` (dijalankan saat onboarding Google user)

---

# External Integrations

| Service | Tujuan | Modul |
|---|---|---|
| **Groq API** (llama-3.1-8b-instant) | Intent classification, laporan AI, analyst, prediction | `utils/groq.ts` |
| **Google OAuth + Sheets API** | Auth Google + storage transaksi/akun Google users | `lib/auth.ts`, `utils/sheets.ts` |
| **Supabase PostgreSQL** | Primary DB (via PgBouncer port 6543 runtime, port 5432 direct) | `lib/prisma.ts` |
| **Cloudflare Turnstile** | CAPTCHA verifikasi login email | `lib/turnstile.ts` |
| **Nodemailer (SMTP)** | Kirim email verifikasi saat registrasi | `lib/email.ts` |
| **NextAuth** | Session management (JWT strategy) | `lib/auth.ts` |

---

# Risks / Blind Spots

- **Dual storage complexity**: logika split Google Sheets vs DB tersebar di setiap route handler — rawan divergensi behavior.
- **Google token refresh**: `utils/token.ts` refresh token OAuth; kalau refresh token expired/revoked, Google users tidak bisa login tanpa re-auth.
- **Sheets sebagai source of truth**: untuk Google users, saldo akun dihitung di-server dari Sheets API — tidak ada cache, tiap request baca ulang.
- **`app/api/record/route.ts` monolitik**: 730 baris, handle 5 intent berbeda — kandidat utama untuk splitting ke subhandlers.
- **Groq rate limit**: key rotation ada, tapi kalau semua key habis user dapat 503 tanpa retry logic.
- **`transferId`**: mekanisme transfer antar akun ada di schema (kolom `transferId`), tapi UI transfer belum terlihat di dashboard — kemungkinan belum fully implemented.
