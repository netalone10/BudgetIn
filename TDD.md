# TDD — BudgetIn

**Product Version**: 1.6.5
**Document Version**: 1.0.0
**Status**: Production / Active Development
**Last Updated**: May 2026
**Primary References**: `PRD.md`, `SYSTEM_MAP.md`, `prisma/schema.prisma`

---

## 1. Tujuan Dokumen

Dokumen ini menjelaskan desain teknis BudgetIn berdasarkan implementasi codebase saat ini. Fokus TDD ini adalah arsitektur, data flow, storage model, modul utama, integrasi eksternal, risiko teknis, dan strategi validasi.

TDD ini dipakai sebagai referensi untuk:

- Onboarding developer.
- Review perubahan teknis.
- Menjaga konsistensi DB dan Google Sheets storage path.
- Mengurangi regresi pada ledger, transfer, budget, savings, bills, dan AI flows.
- Menjadi dasar dokumen teknis lanjutan seperti ADR, API spec, dan runbook.

---

## 2. System Overview

BudgetIn adalah full-stack Next.js monolith dengan App Router. UI, server rendering, API route handlers, auth, dan business logic berada dalam satu repository.

```text
Browser / Client UI
  → Next.js App Router pages/components
  → API Routes under app/api
  → Domain helpers in lib/ and utils/
  → PostgreSQL via Prisma and/or Google Sheets API
  → External services: Google OAuth, Groq, Resend, Turnstile
```

### 2.1 High-Level Characteristics

- **Monolith**: satu aplikasi Next.js menangani frontend dan backend.
- **Hybrid storage**: email/password users memakai PostgreSQL; Google OAuth users dapat memakai Google Sheets untuk ledger/account/budget path tertentu.
- **Ledger-first accounting**: saldo dihitung dari transaksi, bukan cache saldo manual.
- **AI-assisted, deterministic-finance**: AI dipakai untuk klasifikasi/narasi; angka penting dihitung server-side.
- **Bahasa utama**: Bahasa Indonesia.
- **Timezone utama**: Asia/Jakarta.

---

## 3. Technology Stack

| Area | Technology |
|---|---|
| Web framework | Next.js 16 App Router |
| UI runtime | React 19 |
| Language | TypeScript 5 |
| Styling | TailwindCSS 4 |
| UI components | shadcn/ui style, Base UI, Lucide |
| Auth | NextAuth.js 4 |
| Database ORM | Prisma 6 |
| Database | PostgreSQL |
| Google storage | Google Sheets API v4 |
| AI | Groq SDK, LLaMA 3.1 8B Instant |
| Email | Resend |
| CAPTCHA | Cloudflare Turnstile |
| Hosting | Vercel |
| Tests | Jest, ts-jest, fast-check |

---

## 4. Repository Structure

```text
BudgetIn/
├── app/
│   ├── api/                         # Server endpoints
│   ├── admin/                       # Admin UI
│   ├── auth/                        # Auth pages and auth error UI
│   ├── dashboard/                   # Authenticated product UI
│   ├── layout.tsx                   # Root layout and metadata
│   └── page.tsx                     # Landing page
├── components/                      # Shared client/server components
├── hooks/                           # Client hooks
├── lib/                             # Server/domain libraries
├── prisma/                          # Prisma schema
├── public/                          # Static assets
├── scripts/                         # Utility scripts
├── types/                           # Type augmentation
├── utils/                           # Domain helpers and integrations
├── PRD.md                           # Product requirements
├── SYSTEM_MAP.md                    # Existing module/system map
└── TDD.md                           # Technical design document
```

### 4.1 Key Directory Responsibilities

| Directory | Responsibility |
|---|---|
| `app/dashboard` | Main authenticated product surfaces. |
| `app/api` | Backend entrypoints and session-scoped data mutation/query. |
| `components` | Reusable UI and product interaction components. |
| `lib` | Shared server-side domain/data helpers and cross-feature utilities. |
| `utils` | Integration adapters, accounting helpers, and prompt-specific logic. |
| `utils/record` | Authoritative prompt recording sub-system. |
| `prisma` | Relational schema and generated Prisma Client config. |

---

## 5. Runtime Architecture

### 5.1 Request Boundaries

BudgetIn has three primary request types:

- **Page render requests**: handled by App Router pages and server components.
- **Client interactions**: handled by client components calling `/api/*` routes through `fetch`.
- **External callbacks**: auth callbacks, email verification, cron, and Google setup recovery flows.

### 5.2 Server Components and Client Components

Server-side pages load initial data where possible, then pass it to client components for interactive refresh/mutation.

Examples:

| Page | Server data | Client surface |
|---|---|---|
| `/dashboard` | `lib/dashboard-data.ts` | `DashboardClient`, `DashboardTabs`, `TransactionCard` |
| `/dashboard/accounts/[accountId]` | `lib/account-detail-data.ts` | Account detail client UI |
| `/dashboard/budget` | `lib/budget-data.ts` | Budget management UI |
| `/admin` | API-backed admin user table and KPI UI | Admin command center |

---

## 6. Authentication and Authorization

### 6.1 Auth Providers

Auth is configured in `lib/auth.ts` using NextAuth.

| Provider | User path | Storage implication |
|---|---|---|
| Google OAuth | Google account sign-in | Creates/uses Google Sheet when permissions are complete. |
| Credentials | Email/password login | Uses PostgreSQL as primary storage. |

### 6.2 Google OAuth Requirements

Required scopes:

```text
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/drive.file
```

If scopes are incomplete or Sheet creation fails, the user is routed to the Google permission/setup recovery flow.

### 6.3 Credentials Requirements

- Passwords are stored as bcrypt hashes.
- Credentials login requires verified email.
- Turnstile is required except for the public demo account.

### 6.4 Authorization Model

- Most `/api/*` routes call `getServerSession(authOptions)` and require `session.userId`.
- Data access is user-scoped by `userId`.
- Admin capabilities are exposed only when `session.isAdmin` is true.
- Admin status is computed server-side and attached to session token.

---

## 7. Storage Design

### 7.1 Storage Mode Resolution

Storage mode is generally inferred from `User.sheetsId`:

```text
if user.sheetsId exists
  → use Google Sheets for supported ledger/account/budget operations
else
  → use PostgreSQL path
```

Google setup recovery introduces a transitional mode where a Google user can temporarily have DB fallback data while `sheetsId` is missing or migration is incomplete.

### 7.2 PostgreSQL Path

PostgreSQL is accessed through Prisma. It stores:

- Auth identity and tokens.
- Email verification data.
- Categories.
- Budgets.
- Transactions for DB users and fallback/metadata use cases.
- Account types and accounts.
- Savings goals and savings contributions.
- Recurring bills and bill payments.
- Google setup migration marker.

### 7.3 Google Sheets Path

Google Sheets is accessed through `utils/sheets.ts`.

Main sheets:

| Sheet | Purpose |
|---|---|
| `Transaksi` | Ledger rows for transactions. |
| `Budget` | Category budget backup/storage for Google users. |
| `Akun` | Account metadata for Google users. |

Current transaction headers:

```text
id, date, amount, category, note, created_at, type,
fromAccountId, fromAccountName, toAccountId, toAccountName, time
```

### 7.4 Storage Compatibility Rule

Google Sheets schema changes should be append-only where possible. Existing column positions must remain stable to avoid breaking older user spreadsheets.

---

## 8. Core Data Model

### 8.1 Entity Relationship Summary

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

### 8.2 Primary Tables

| Table | Technical role |
|---|---|
| `users` | Auth identity, Google tokens, `sheets_id`, email verification, migration marker. |
| `transactions` | DB ledger rows with signed Decimal amount, `date`, `time`, `type`, optional `account_id`, optional `transfer_id`. |
| `accounts` | Account metadata, active state, currency, optional credit-card billing dates. |
| `account_types` | User-defined account classifications: `asset` or `liability`. |
| `categories` | Expense/income categories, savings flag, rollover flag. |
| `budgets` | Category budget per user/month. |
| `savings_goals` | Savings target metadata. |
| `savings_contributions` | Per-goal progress linked to transaction ID. |
| `recurring_bills` | Bill definitions and next due schedule. |
| `bill_payments` | Monthly bill payment records. |

### 8.3 Time Representation

Transactions store date and time separately:

```text
date: YYYY-MM-DD
time: HH:mm
```

Rules:

- New transactions default to current Jakarta time when explicit time is missing.
- Legacy/missing time normalizes to `00:00`.
- Prompt day-part words without explicit hour use submit-time fallback.
- Sorting should compare `date + time`, not date only.

---

## 9. Ledger and Accounting Semantics

### 9.1 Amount Rules

| Transaction kind | Amount rule |
|---|---|
| Expense | Non-zero signed value. Negative allowed for correction/refund/reversal. |
| Income | Non-zero signed value. Negative allowed for correction/reversal. |
| Transfer | Positive-only. |
| Transfer fee | Positive-only expense. |

### 9.2 Transfer Representation

| Storage | Representation |
|---|---|
| PostgreSQL | Two rows: `transfer_out` and `transfer_in`, sharing `transferId`. |
| Google Sheets | One `Transfer` row with `fromAccount*` and `toAccount*` fields. |

### 9.3 Expense Classification

All analytics that need spending/expense must use `lib/transaction-classification.ts`:

- `isTransferTransaction`
- `isExpenseTransaction`

This prevents transfer principal from being counted as spending while still including transfer fee as an expense.

### 9.4 Account Balance Rule

Account balances and net worth should be computed from ledger rows through `utils/account-balance.ts` or equivalent server-side helpers. Account balance should not rely on a mutable cached balance field as the source of truth.

---

## 10. Prompt Recording Design

### 10.1 Entry Point

Main endpoint:

```text
POST /api/record
```

Implementation:

```text
app/api/record/route.ts
  → validate session
  → load storage mode
  → load categories and active accounts
  → pre-check non-monetary units
  → classify intent through utils/groq.ts
  → dispatch to utils/record/intent-handlers.ts
```

### 10.2 Supported Intents

| Intent | Handler | Purpose |
|---|---|---|
| `transaksi` | `handleTransaksi` | Single expense transaction. |
| `transaksi_bulk` | `handleTransaksiBulk` | Multiple expenses from one prompt. |
| `pemasukan` | `handlePemasukan` | Income transaction. |
| `transfer` | `handleTransfer` | Account transfer with optional fee. |
| `budget_setting` | `handleBudgetSetting` | Set/update monthly budget. |
| `laporan` | `handleLaporan` | AI-assisted report from server-side data. |
| `unknown` | route fallback | Clarification response. |

### 10.3 Account Resolution

Prompt account resolution is implemented in `utils/record/account-resolver.ts`.

Resolution strategy:

```text
explicit account name
  → exact/partial match against runtime accounts
  → if multiple matches: return clarification
  → if no match but account name exists: auto-create inferred account
  → if no account name: ask user to select an account
```

Account inference detects common Indonesian account patterns such as cash, e-wallet, bank, credit card, paylater, and loan/hutang.

### 10.4 Amount Parsing and Validation

Amount correction and validation live in `utils/record/amount-parser.ts`.

Responsibilities:

- Normalize Indonesian amount shorthand such as `rb`, `ribu`, `k`, `jt`, `juta`.
- Reject invalid zero amounts.
- Allow signed expense/income corrections.
- Prevent non-monetary units from being interpreted as money without a monetary indicator.

### 10.5 Savings Prompt Handling

Savings prompt allocation is implemented through `utils/record/savings-goal-resolver.ts`.

Rules:

| Goal state | Behavior |
|---|---|
| No goal | Record as unallocated `Tabungan`. |
| One goal | Auto-allocate contribution. |
| Multiple goals with clear match | Allocate to matched goal. |
| Multiple ambiguous goals | Return `savings_goal_selection` clarification and pending action. |

Goal progress is based only on `SavingsContribution`, not all `Tabungan` transactions.

---

## 11. Manual Transaction Design

### 11.1 Entry Point

```text
POST /api/transactions/manual
```

Manual form supports:

- Expense.
- Income.
- Transfer.

### 11.2 Validation

Manual transaction endpoint validates:

- Session user.
- Date format and impossible dates.
- Time format.
- Non-zero signed expense/income amount.
- Positive transfer amount.
- Required account/category fields.
- Different source and destination account for transfers.
- Same currency for transfer accounts.
- Optional positive transfer fee.

### 11.3 Write Behavior

| Type | PostgreSQL | Google Sheets |
|---|---|---|
| Expense | Create `expense` transaction row. | Append transaction with `fromAccount*`. |
| Income | Create `income` transaction row. | Append transaction with `toAccount*`. |
| Transfer | Create `transfer_out` + `transfer_in`; optional fee row. | Append one `Transfer` row; optional fee row. |

---

## 12. Feature Module Design

### 12.1 Dashboard

Main files:

- `app/dashboard/page.tsx`
- `app/dashboard/DashboardClient.tsx`
- `lib/dashboard-data.ts`
- `components/DashboardTabs.tsx`
- `components/TransactionCard.tsx`

Responsibilities:

- Load initial user financial state.
- Record prompt transactions.
- Show today summary.
- Show transaction history and pagination.
- Refresh dependent data after mutations.
- Preserve transfer from/to metadata for Sheets transaction classification.

### 12.2 Accounts

Main files:

- `app/api/accounts/route.ts`
- `app/api/accounts/[accountId]/route.ts`
- `app/api/accounts/[accountId]/adjust/route.ts`
- `app/api/accounts/[accountId]/transactions/route.ts`
- `app/api/accounts/networth-history/route.ts`
- `utils/account-balance.ts`
- `lib/account-detail-data.ts`

Responsibilities:

- Account CRUD.
- Active/inactive account lifecycle.
- Account balance and net worth calculation.
- Account detail transaction history.
- Balance adjustment via ledger correction.
- Credit-card billing metadata.

### 12.3 Account Types

Main files:

- `app/api/account-types/route.ts`
- `app/api/account-types/[typeId]/route.ts`
- `utils/account-types.ts`

Responsibilities:

- Manage account type name, icon, color, sort order, active status.
- Keep classification as `asset` or `liability`.
- Preserve inactive type for existing account edit flow.
- Enforce credit-card field rules when applicable.

### 12.4 Budget

Main files:

- `app/api/budget/route.ts`
- `app/api/budget/[id]/route.ts`
- `app/api/budget/rollover/route.ts`
- `lib/budget-data.ts`

Responsibilities:

- Budget per category/month.
- Budget upsert from prompt or UI.
- Spending realization by category.
- Rollover support.
- Exclude transfer principal from spending.

### 12.5 Cashflow

Main file:

- `app/api/cashflow/route.ts`

Responsibilities:

- Period-based income/expense/net flow.
- Category breakdown.
- Credit-card billing behavior where applicable.
- Transfer-safe expense calculation.

### 12.6 Savings

Main files:

- `app/api/savings/route.ts`
- `app/api/savings/[goalId]/route.ts`
- `utils/record/savings-goal-resolver.ts`

Responsibilities:

- Savings goal CRUD.
- Goal progress from contribution records.
- Prompt-driven contribution allocation.
- Clarification UI support for ambiguous goals.

### 12.7 Recurring Bills

Main files:

- `app/api/bills/route.ts`
- `app/api/bills/[id]/pay/route.ts`
- `app/api/bills/[id]/skip/route.ts`
- `app/api/bills/summary/route.ts`
- `app/api/cron/bills/route.ts`
- `utils/bill-utils.ts`

Responsibilities:

- Bill definitions and schedule metadata.
- Pay and skip actions.
- Bill summary.
- Optional scheduled processing endpoint.
- Optional auto-record support through bill model and endpoint behavior.

### 12.8 AI Analyst and Prediction

Main files:

- `app/api/analyst/route.ts`
- `app/api/prediction/route.ts`
- `utils/groq.ts`

Responsibilities:

- Deterministic financial metrics server-side.
- AI-generated narrative, anomalies, and recommendations.
- Forecasting/prediction from transaction data.
- Expense calculation must exclude transfer principal.

### 12.9 Backup and Restore

Main files:

- `lib/backup.ts`
- `app/api/backup/export/route.ts`
- `app/api/backup/preview/route.ts`
- `app/api/backup/restore/route.ts`

Responsibilities:

- Canonical JSON export.
- Preview before restore.
- Restore into DB or Sheets-compatible target.
- Exclude secrets and tokens.
- Normalize data across categories, account types, accounts, transactions, budget, savings, bills, and payments.

### 12.10 Google Setup Migration

Main files:

- `app/api/google-setup-migration/route.ts`
- `lib/backup.ts`
- Google setup recovery UI components

Responsibilities:

- Detect Google setup required mode.
- Preview DB fallback data.
- Execute migration into Sheets.
- Mark migration complete when Sheets already contains correct data.
- Preserve fallback data unless explicitly migrated/handled.

### 12.11 Admin Command Center

Main files:

- `app/admin/page.tsx`
- `app/api/admin/stats/route.ts`
- `app/api/admin/users/route.ts`
- `app/api/admin/users/[userId]/route.ts`

Responsibilities:

- Admin KPIs.
- User search/filter/sort/pagination.
- Provider/data-mode visibility.
- User operational actions such as resend verification, reset password, and delete user.

---

## 13. API Design Principles

### 13.1 General Rules

- API routes should validate session at the boundary.
- API routes should scope all reads/writes to `session.userId`.
- API routes should return clear Indonesian error messages for user-facing failures.
- Domain-specific calculations should live in `lib` or `utils`, not be duplicated in UI components.
- Writes that touch multiple DB rows should use Prisma transactions where consistency is required.

### 13.2 Error Response Patterns

Common statuses:

| Status | Meaning |
|---|---|
| `400` | Invalid input or invalid user-owned resource. |
| `401` | Unauthorized session or expired Google token. |
| `403` | Forbidden/admin guard failure. |
| `404` | User-scoped resource not found. |
| `500` | Unexpected server failure. |
| `503` | External AI service unavailable. |

---

## 14. External Integrations

| Integration | Module | Purpose | Failure handling |
|---|---|---|---|
| Google OAuth | `lib/auth.ts` | Sign-in and grant Sheets access. | Redirect to auth error/recovery flow. |
| Google Sheets API | `utils/sheets.ts` | Google-user ledger/account/budget storage. | Re-auth on token failure; fallback messages on read/write failure. |
| Groq | `utils/groq.ts` | Intent classification and AI narrative. | API key rotation; return service unavailable for prompt failure. |
| Resend | `lib/email.ts` | Verification and reset password email. | Surface send failure to user/admin flow. |
| Turnstile | `lib/turnstile.ts` | CAPTCHA for credentials login. | Reject credentials authorization. |
| Vercel | Deployment/runtime | Hosting, analytics, speed insights. | Use platform logs and deployment status. |

---

## 15. Caching and Performance

### 15.1 Current Caching

- Google Sheets helper uses short in-memory TTL cache for rapid period toggling.
- Some API responses use private cache headers where safe.
- Dashboard server data is loaded initially and refreshed client-side after mutations.

### 15.2 Performance Constraints

- Google Sheets API latency can dominate Google-user flows.
- `/api/record` depends on Groq for classification, so it has external API latency and availability risk.
- Transaction reads return up to 200 rows per period to bound payload size.
- Client transaction list uses pagination options 10/20/50.

### 15.3 Future Performance Improvements

- Add request-level rate limiting for AI endpoints.
- Add more focused server-side aggregation endpoints for large user histories.
- Add structured telemetry around Sheets latency and Groq latency.

---

## 16. Security and Privacy Design

### 16.1 Security Controls

- Session validation in API routes.
- User-scoped Prisma queries.
- bcrypt password storage.
- Email verification for credentials users.
- Turnstile CAPTCHA for credentials login.
- Google OAuth scope validation.
- Server-side admin guard.
- Destructive account actions require explicit confirmation phrase.
- Backup excludes secrets/tokens.

### 16.2 Sensitive Data

Sensitive data includes:

- Password hashes.
- Google access/refresh tokens.
- Email verification tokens.
- User financial transactions.
- Backup JSON uploaded by user.

### 16.3 Privacy Boundary

A user must only access their own financial data. Any API that accepts resource IDs must validate ownership before read/write/delete.

---

## 17. Reliability and Consistency

### 17.1 Consistency Invariants

- Transfer principal must not count as expense.
- Transfer fee must count as expense.
- Account balances must derive from ledger rows.
- Savings goal progress must derive from `SavingsContribution` rows.
- Google Sheets transfer rows must preserve from/to account IDs or names.
- DB transfer pairs must share `transferId`.
- Date/time sorting must use both `date` and `time`.
- Expense/income corrections may be negative; transfer amounts may not.

### 17.2 Dual Storage Invariant

Any user-visible transaction behavior should be behaviorally equivalent across PostgreSQL and Google Sheets paths even if the underlying representation differs.

### 17.3 Failure Modes

| Failure | Expected behavior |
|---|---|
| Google token expired/revoked | Return re-auth message or recovery UI. |
| Missing Google scopes | Block/recover through Google permission flow. |
| Groq unavailable | Return 503 or user-facing AI unavailable message. |
| Sheets API write fails | Return clear save failure and avoid pretending success. |
| DB transaction write fails | Return clear save failure. |
| Ambiguous prompt account/goal | Return clarification instead of guessing. |

---

## 18. Testing Strategy

### 18.1 Core Commands

```bash
npx tsc --noEmit
npx jest <test files> --runInBand
```

`npm run lint` currently maps to `next lint` and may fail with a Next CLI compatibility issue in this setup.

### 18.2 Focused Test Areas

| Area | Suggested tests |
|---|---|
| Amount parser | `rb`, `jt`, signed amounts, non-monetary units. |
| Transaction classification | Transfer exclusion, transfer fee inclusion, Sheets transfer detection. |
| Double-entry accounting | DB transfer pair behavior and balance effect. |
| Transaction time | Explicit time, fallback current time, legacy `00:00`. |
| Savings goal resolver | 0/1/multiple goal allocation and ambiguity. |
| Manual transactions | Date/time validation, transfer same-currency rule, negative correction support. |
| Backup/restore | Schema normalization and secrets exclusion. |
| Bills | Pay/skip summary and next due date behavior. |

### 18.3 Manual Regression Checklist

Before release touching core finance logic:

- Record expense by prompt.
- Record income by prompt.
- Record bulk expense prompt.
- Record transfer with and without fee.
- Record manual expense/income/transfer.
- Edit and delete transaction.
- Check dashboard spending excludes transfer principal.
- Check account balances and net worth.
- Check budget spent values.
- Check savings goal progress.
- Check Google Sheets user path if modified.
- Check DB user path if modified.

---

## 19. Deployment and Operations

### 19.1 Build

Production build script:

```bash
npm run build
```

This runs Prisma generate before Next build.

### 19.2 Database Changes

Database schema changes should be handled carefully because `prisma db push` or migrations mutate the database.

Recommended process:

1. Update `prisma/schema.prisma`.
2. Run `npx prisma generate`.
3. Run `npx tsc --noEmit`.
4. Confirm with project owner before applying DB mutation to production or shared DB.
5. Run migration/db push only after confirmation.

### 19.3 Release Notes

Production releases are documented in `lib/changelog.ts` and surfaced at `/dashboard/changelog`.

Versioning uses Semantic Versioning. Version/changelog/commit/push workflow should confirm the target version first.

---

## 20. Technical Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Dual storage divergence | DB and Sheets users see different behavior. | Keep shared helpers and focused tests for both paths. |
| Transfer misclassification | Spending/budget/analyst numbers become wrong. | Always use `isExpenseTransaction`. |
| Savings contribution drift | Goal progress becomes inaccurate. | Maintain contribution lifecycle on transaction changes. |
| Google token failure | Sheets users cannot read/write. | Recovery UI and clear re-auth errors. |
| Groq dependency | Prompt input and AI narrative unavailable. | Deterministic validation before/after AI, graceful 503. |
| Signed amount display bugs | Refund/correction totals become confusing. | Test formatting and aggregation with negative values. |
| Sheets schema mutation | Existing spreadsheets break. | Append-only schema evolution. |
| Admin action misuse | Destructive user operation. | Server-side admin guard and explicit operational UX. |

---

## 21. Technical Decision Log

| Decision | Current rationale | Related files |
|---|---|---|
| Next.js monolith | Simpler deployment and co-location of UI/API/domain logic. | `app/`, `lib/`, `utils/` |
| Hybrid DB/Sheets storage | Supports simple DB users and Google Sheets ownership users. | `lib/auth.ts`, `utils/sheets.ts`, `utils/db-transactions.ts` |
| Ledger-derived balances | Avoids stale mutable balance state. | `utils/account-balance.ts` |
| DB transfer pair vs Sheets single transfer row | Fits relational ledger while preserving Sheets compactness. | `intent-handlers.ts`, `sheets.ts` |
| AI only for classification/narrative | Prevents AI from being source of financial truth. | `utils/groq.ts`, `app/api/analyst/route.ts` |
| Savings progress via contribution table | Avoids counting all `Tabungan` transactions incorrectly. | `prisma/schema.prisma`, `app/api/savings/route.ts` |
| Separate `date` and `time` fields | Preserves date filtering while enabling accurate intraday ordering. | `lib/transaction-time.ts`, `prisma/schema.prisma` |

---

## 22. Open Technical Backlog

- Fix lint script compatibility with current Next CLI.
- Add rate limiting for AI/prompt endpoints.
- Add more tests for bills, backup/restore, Google migration, and account type edge cases.
- Create `API.md` for endpoint-level request/response documentation.
- Create `ADR/` documents for major architectural decisions.
- Create operational runbook for deploy, rollback, Google permission recovery, and DB migration.
- Consider structured observability for AI and Google Sheets latency/errors.

---

## 23. Relationship to Other Documents

| Document | Role |
|---|---|
| `PRD.md` | Product intent, user-facing requirements, feature scope. |
| `SYSTEM_MAP.md` | Existing concise technical map and implementation notes. |
| `TDD.md` | Formal technical design and engineering reference. |
| `prisma/schema.prisma` | Source of truth for relational data model. |
| `lib/changelog.ts` | Production release history surfaced in app. |
