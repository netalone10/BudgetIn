# Project Summary

- **Tujuan**: Aplikasi manajemen keuangan personal berbasis AI untuk mencatat transaksi natural language, input manual, budget tracking, tabungan per goal, recurring bills, cashflow, kalender transaksi, net worth, dan analisis/prediksi keuangan.
- **Tech stack**: Next.js 16 App Router, React 19, TypeScript, NextAuth v4, Prisma ORM, PostgreSQL/Supabase, Google Sheets API, Groq AI, Cloudflare Turnstile, Tailwind CSS v4, shadcn/ui-style components.
- **Arsitektur**: Full-stack Next.js monolith dengan React Server/Client Components dan API Routes. Storage bercabang: Google OAuth users memakai Google Sheets sebagai ledger utama; email/password users memakai PostgreSQL. Beberapa metadata shared tetap disimpan di PostgreSQL.
- **Prinsip ledger**: Saldo akun dihitung dari ledger transaksi, bukan cache saldo. Transfer principal dikecualikan dari spending/expense analytics; fee transfer tetap expense kategori `Biaya Admin`.

---

# Core Logic Flow

**AI prompt recording:**
```text
Dashboard / account detail prompt UI → POST /api/record
  → getServerSession(authOptions)
  → load user storage mode, categories, active accounts
  → pre-validate monetary input
  → classifyIntent(utils/groq.ts)
  → dispatch to utils/record/intent-handlers.ts
    → account resolver (match, clarify, or auto-create)
    → amount parser/correction
    → savings goal resolver when category/prompt is Tabungan
    → write to Sheets or PostgreSQL
    → upsert category / savings contribution when needed
```

**Supported AI intents:**
```text
transaksi         → expense, allows negative non-zero corrections/refunds
transaksi_bulk    → multiple expense items from one prompt
pemasukan         → income, allows negative non-zero corrections/reversals
transfer          → positive-only account transfer with optional fee
budget_setting    → create/update budget for current month
laporan           → AI summary using current ledger + budgets
unknown           → clarification response
```

**Manual transaction recording:**
```text
ManualTransactionForm → POST /api/transactions/manual
  → expense/income: validate non-zero signed amount + account + category
  → transfer: validate positive amount, source/destination account, same currency
  → [Sheets] append one Transfer row with from+to account fields; optional fee expense row
  → [DB] create transfer_out + transfer_in rows sharing transferId; optional fee expense row
```

**Read transactions:**
```text
GET /api/record?period=...
  → [Sheets user] getValidToken → getTransactions(utils/sheets.ts)
  → [DB user] getTransactionsDB(utils/db-transactions.ts)
  → return latest 200 rows
```

**Account balances and account detail:**
```text
GET /api/accounts → getAccountBalances(utils/account-balance.ts)
GET /api/accounts/[accountId]/transactions → account transaction history
app/dashboard/accounts/[accountId]/page.tsx → getAccountDetailData(lib/account-detail-data.ts)
```

**Dashboard server data:**
```text
app/dashboard/page.tsx
  → getDashboardData(lib/dashboard-data.ts)
  → DashboardClient + DashboardTabs + TransactionCard
  → preserves transfer from/to account fields so Sheets transfers are classified correctly
```

**Savings goals:**
```text
/dashboard/savings → /api/savings
  → SavingsGoal rows define goals
  → SavingsContribution rows define actual per-goal progress
  → prompt savings flow auto-allocates 0/1/matched goals or asks clarification for multiple ambiguous goals
```

**Recurring bills:**
```text
/dashboard/bills → /api/bills, /api/bills/summary
  → RecurringBill definitions
  → pay/skip actions under /api/bills/[id]
  → optional cron endpoint /api/cron/bills
```

**AI analysis:**
```text
/dashboard/analyst → GET /api/analyst?period=...
/api/prediction → AI spending prediction
POST /api/record intent=laporan → narrative report
```

**Family mode (read-only consolidated):**
```text
Keanggotaan SELALU di Postgres (Family/FamilyMember/FamilyInvite), independen
dari storage ledger tiap anggota (Sheets vs DB). Owner pun punya baris FamilyMember.

/dashboard/family → GET /api/family + GET /api/family/dashboard
  → getFamilyContext / getFamilyMemberIds (lib/family.ts)
  → getFamilyLedger: loop anggota → getMemberLedger (branch sheetsId) → merge + tag ownerUserId
  → getFamilyNetWorth: Σ net worth per anggota (path murah, tanpa merge mentah)
  → summarizeFamily: income/expense/kategori/per-orang + eliminasi pasangan familyTransferId
  → degradasi anggun: 1 anggota gagal (token Sheets) → ditandai error, view tetap render

Invite: POST /api/family/invite (owner) → email (lib/email.ts) → /family/join?token=...
  → GET/POST /api/family/invite/accept (validasi email cocok + consent)

Transfer antar-anggota (Opsi A — auto 2 kaki):
  POST /api/family/transfer
  → tulis kaki penerima (income) lalu kaki pengirim (expense), familyTransferId sama
  → lintas store (DB: prisma.create / Sheets: appendTransaction + getValidToken(memberId))
  → rollback kompensasi best-effort kalau kaki kedua gagal (atomicity lintas store tidak dijamin)
  → di family view kedua kaki dieliminasi agar tidak double-count
```

---

# Clean Tree

```text
BudgetIn/
├── app/
│   ├── api/
│   │   ├── account-types/                     # Account type CRUD
│   │   ├── accounts/                          # Account CRUD, balances, history, net worth
│   │   │   ├── [accountId]/adjust/route.ts
│   │   │   ├── [accountId]/transactions/route.ts
│   │   │   └── networth-history/route.ts
│   │   ├── admin/                             # Admin stats/user controls
│   │   ├── analyst/route.ts                   # AI financial analyst
│   │   ├── auth/                              # NextAuth + email auth helpers
│   │   ├── bills/                             # Recurring bill CRUD, pay/skip, summary
│   │   ├── budget/                            # Budget CRUD + rollover
│   │   ├── cashflow/route.ts                  # Cashflow and credit-card billing data
│   │   ├── categories/                        # Category CRUD
│   │   ├── cron/bills/route.ts                # Scheduled bill processing endpoint
│   │   ├── prediction/route.ts                # AI prediction
│   │   ├── record/                            # Core AI prompt record/read/update/delete
│   │   ├── savings/                           # Savings goals and progress
│   │   ├── transactions/                      # Manual and calendar transaction APIs
│   │   ├── user/                              # Profile/password update
│   │   └── verify-email/route.ts
│   ├── admin/                                 # Admin UI
│   ├── auth/                                  # Auth/error pages
│   ├── dashboard/
│   │   ├── accounts/                          # Accounts list + account detail page
│   │   ├── analyst/                           # Analyst UI
│   │   ├── bills/                             # Recurring bills UI
│   │   ├── budget/                            # Budget UI
│   │   ├── calendar/                          # Transaction calendar UI
│   │   ├── cashflow/                          # Cashflow UI
│   │   ├── panduan/                           # Guide/help page
│   │   ├── savings/                           # Savings goals UI
│   │   ├── settings/account-types/            # Account type settings
│   │   ├── DashboardClient.tsx
│   │   └── page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                                    # UI primitives
│   ├── DashboardTabs.tsx                      # Main dashboard tabs and aggregations
│   ├── ManualTransactionForm.tsx              # Expense/income/transfer manual form
│   ├── TransactionCard.tsx                    # Transaction display/edit/delete card
│   ├── SavingsGoalCard.tsx
│   ├── BillCard.tsx
│   └── Providers.tsx
├── lib/
│   ├── auth.ts                                # NextAuth Google + Credentials config
│   ├── account-detail-data.ts                 # Server data for account detail
│   ├── dashboard-data.ts                      # Server data for dashboard
│   ├── budget-data.ts                         # Server data for budget page
│   ├── transaction-classification.ts          # Transfer vs expense classification helpers
│   ├── savings-utils.ts                       # Savings keyword helpers
│   ├── prisma.ts                              # Prisma singleton
│   └── __tests__/                             # Jest/property tests
├── utils/
│   ├── record/
│   │   ├── account-resolver.ts                # Match/clarify/auto-create accounts
│   │   ├── amount-parser.ts                   # Amount correction and validation
│   │   ├── intent-handlers.ts                 # /api/record intent handlers
│   │   └── savings-goal-resolver.ts           # Goal allocation/clarification logic
│   ├── account-balance.ts                     # Pure-ledger balance/net worth
│   ├── db-transactions.ts                     # DB transaction CRUD
│   ├── groq.ts                                # Groq client, key rotation, intent prompt
│   ├── sheets.ts                              # Google Sheets ledger/account/budget API
│   └── token.ts                               # Google OAuth token refresh
├── prisma/
│   └── schema.prisma
├── package.json
└── SYSTEM_MAP.md
```

---

# Module Map

| File | Main exports / role | Notes |
|---|---|---|
| `app/api/record/route.ts` | `GET`, `POST` | Main AI prompt API; dispatches classified intents to record handlers. |
| `utils/record/intent-handlers.ts` | `handleTransaksi`, `handleTransaksiBulk`, `handlePemasukan`, `handleTransfer`, `handleBudgetSetting`, `handleLaporan` | Authoritative prompt-side write logic. |
| `utils/record/account-resolver.ts` | `buildAccountResolver` | Resolves named accounts, asks clarification, or auto-creates inferred account type. |
| `utils/record/amount-parser.ts` | `correctAmount`, `isValidAmount` | Normalizes `rb`/`jt` and validates signed non-zero expense/income amounts. |
| `utils/record/savings-goal-resolver.ts` | `resolveSavingsGoalForPrompt` | Allocates savings prompts to a goal or returns goal-selection clarification. |
| `app/api/transactions/manual/route.ts` | `POST` | Manual expense/income/transfer entry, including optional transfer fee. |
| `app/api/record/[recordId]/route.ts` | update/delete transaction | Edit/delete existing records. |
| `app/api/accounts/route.ts` | account list/create | Uses pure-ledger balances. |
| `app/api/accounts/[accountId]/transactions/route.ts` | account transaction history | Used by account detail page. |
| `app/api/accounts/networth-history/route.ts` | net worth time series | Account/net worth analytics. |
| `app/api/savings/route.ts` | savings goal list/create | Progress comes from `SavingsContribution`, not all Tabungan transactions. |
| `app/api/bills/route.ts` | recurring bill CRUD | Works with pay/skip/summary endpoints. |
| `app/api/budget/route.ts` | budget CRUD | Budget by category/month. |
| `app/api/budget/rollover/route.ts` | rollover handling | Category rollover support. |
| `app/api/cashflow/route.ts` | cashflow data | Includes credit-card billing behavior. |
| `app/api/analyst/route.ts` | AI analyst | Uses ledger data + Groq. |
| `app/api/prediction/route.ts` | AI forecast | Spending prediction. |
| `lib/transaction-classification.ts` | `isTransferTransaction`, `isExpenseTransaction` | Central filter for excluding transfer principal from expenses. |
| `lib/dashboard-data.ts` | `getDashboardData` | Initial dashboard payload for server-rendered dashboard. |
| `lib/account-detail-data.ts` | account detail data | Account summary/history server data. |
| `utils/sheets.ts` | Sheets CRUD and ledger helpers | Google-user storage path. |
| `utils/db-transactions.ts` | DB transaction CRUD | Email-user storage path. |
| `utils/account-balance.ts` | account balance/net worth calculations | Pure ledger account balance logic. |
| `utils/groq.ts` | `classifyIntent`, `callWithRotation` | Groq prompt parser and API-key rotation. |
| `lib/auth.ts` | `authOptions` | Google OAuth + Credentials auth. |
| `lib/family.ts` | `getFamilyContext`, `getFamilyMemberIds` | Membership & scope helpers (keanggotaan di Postgres). |
| `lib/family-data.ts` | `getFamilyLedger`, `getFamilyNetWorth`, `summarizeFamily` | Consolidation engine: merge ledger lintas DB+Sheets, net worth, eliminasi transfer antar-anggota. |
| `app/api/family/route.ts` | `GET`/`POST`/`DELETE` | Info/buat/bubarkan family. |
| `app/api/family/invite/route.ts` + `invite/accept` | invite/accept | Undangan email + terima (validasi email + consent). |
| `app/api/family/member/[userId]/route.ts` | `DELETE` | Keluar / keluarkan anggota. |
| `app/api/family/dashboard/route.ts` | `GET` | Data konsolidasi: net worth + summary + ledger. |
| `app/api/family/accounts/route.ts` | `GET` | Akun per anggota (untuk form transfer). |
| `app/api/family/transfer/route.ts` | `POST` | Transfer antar-anggota Opsi A (auto 2 kaki, lintas store). |
| `app/dashboard/family/*` | Family UI | Net worth/spending konsolidasi + kelola anggota + transfer. |

---

# Data Model

```text
User
├── Category
│   ├── Budget
│   └── RecurringBill?
├── Transaction
│   └── Account?
├── SavingsGoal
│   └── SavingsContribution
├── AccountType
│   └── Account
│       ├── Transaction
│       └── RecurringBill
└── RecurringBill
    └── BillPayment
```

**Primary tables:**

- **`users`**: auth identity, Google tokens, optional `sheetsId`, email verification fields.
- **`transactions`**: ledger rows with signed Decimal amount, `type`, optional `accountId`, optional `transferId`, and `isInitialBalance`.
- **`accounts`**: account metadata, type, currency, active state, optional credit-card billing dates.
- **`account_types`**: user-defined classifications: `asset` or `liability`.
- **`categories`**: expense/income categories, savings flag, rollover flag.
- **`budgets`**: category budget per month.
- **`savings_goals`**: target amount/deadline metadata.
- **`savings_contributions`**: per-goal progress linked to transaction ID.
- **`recurring_bills`**: recurring bill definitions and schedule metadata.
- **`bill_payments`**: monthly bill payment records linked to recurring bills.
- **`families` / `family_members` / `family_invites`**: Family mode (read-only consolidated). `family_members` `@@unique([userId])` → 1 user = 1 family (MVP). Selalu di Postgres untuk semua user.
- **`transactions.familyTransferId` / `counterpartyUserId`**: penanda transfer antar-anggota (pasangan expense pengirim + income penerima) untuk eliminasi di family view. Di Sheets disimpan kolom M-N.

---

# Transaction Semantics

- **Expense/income amount**: non-zero signed value. Negative values are valid for refunds, returns, corrections, and reversals.
- **Transfer amount**: positive-only. DB users get paired `transfer_out` and `transfer_in` rows with the same `transferId`; Sheets users get one `Transfer` row with both source and destination account fields.
- **Transfer fee**: optional positive expense from the source account, category `Biaya Admin`.
- **Expense analytics**: always use `isExpenseTransaction`; this excludes transfer principal and includes transfer fee.
- **Sheets transfer detection**: `category === "Transfer"` plus from/to account IDs or names counts as transfer principal.
- **Savings progress**: only `savings_contributions` counts toward goal progress. Generic `Tabungan` transactions without an allocated contribution do not increase a specific goal.
- **Family transfer elimination**: di level family, pasangan transaksi ber-`familyTransferId` (expense pengirim + income penerima) dieliminasi dari agregasi spending/income (`summarizeFamily`). Net worth keluarga = Σ net worth anggota dan tidak terpengaruh (uang hanya berpindah dalam keluarga). Buku pribadi tiap anggota tidak berubah (tetap expense/income masing-masing).

---

# External Integrations

| Service | Purpose | Module |
|---|---|---|
| Groq API | Intent classification, reports, analyst, prediction | `utils/groq.ts` |
| Google OAuth | Login and token access for Sheets users | `lib/auth.ts`, `utils/token.ts` |
| Google Sheets API | Ledger/account/budget storage for Google users | `utils/sheets.ts` |
| PostgreSQL/Supabase | Primary relational DB for email users and metadata | `lib/prisma.ts`, `prisma/schema.prisma` |
| Cloudflare Turnstile | CAPTCHA verification for credentials flow | `lib/turnstile.ts` |
| Email provider | Verification email delivery | `lib/email.ts` |
| NextAuth | Session/JWT management | `lib/auth.ts` |

---

# Validation Notes

- **Typecheck**: use `npx tsc --noEmit`.
- **Focused tests**: use `npx jest <test files> --runInBand`.
- **Lint caveat**: `npm run lint` currently calls `next lint` and may fail because the current Next CLI treats `lint` as an invalid project directory in this setup.

---

# Risks / Blind Spots

- **Dual storage divergence**: Sheets and DB paths must stay behaviorally aligned for transaction validation, transfers, savings, and account balances.
- **Transfer modeling differs by storage**: DB uses two rows; Sheets uses one row with from/to metadata. Any aggregation must use `lib/transaction-classification.ts` instead of checking only `type === "expense"`.
- **Savings allocation is explicit**: goal progress depends on `SavingsContribution`; edits/deletes of savings transactions need care to avoid orphaned or stale contributions.
- **Google token failure**: revoked/expired refresh tokens can break Sheets reads/writes until re-auth.
- **Groq dependency**: AI flows rely on external API availability and configured `GROQ_API_KEY_*` rotation.
- **Signed amounts**: many UI summaries must preserve sign for corrections while still presenting totals intuitively.
- **Family cross-store writes**: `POST /api/family/transfer` menulis dua kaki ke store berbeda (DB+Sheets) — tidak ada atomicity lintas store; dipakai kompensasi best-effort. Auto-create kaki income ke ledger Sheets penerima butuh token tersimpan penerima valid. Asumsi MVP: semua anggota mata uang sama (IDR).
