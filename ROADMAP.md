# Product Roadmap — BudgetIn

**Product Version Baseline**: 1.6.5
**Document Version**: 1.0.0
**Status**: Planning Draft
**Last Updated**: May 2026
**Primary References**: `PRD.md`, `TDD.md`, `SYSTEM_MAP.md`, `lib/changelog.ts`

---

## 1. Tujuan Roadmap

Roadmap ini menerjemahkan arah produk BudgetIn ke rencana bertahap yang bisa dipakai untuk prioritas development, release planning, dan komunikasi status produk.

Roadmap ini bukan komitmen tanggal rilis final. Urutan dapat berubah berdasarkan bug produksi, feedback user, biaya integrasi eksternal, dan risiko teknis.

---

## 2. Product Direction

BudgetIn diarahkan menjadi aplikasi manajemen keuangan personal berbahasa Indonesia yang cepat, akurat, dan mudah digunakan untuk mencatat transaksi, mengelola akun/dompet, memantau budget, menabung per tujuan, mengelola tagihan, dan mendapatkan insight AI.

### 2.1 Product Principles

- **Fast capture**: input transaksi harus cepat melalui prompt atau manual form.
- **Financial correctness first**: saldo, transfer, budget, dan tabungan harus akurat sebelum fitur visual/AI diperluas.
- **User-owned data**: Google Sheets path dan backup/restore tetap menjadi nilai penting.
- **AI as assistant**: AI membantu klasifikasi, laporan, dan insight, tetapi bukan sumber kebenaran angka finansial.
- **Low-friction maintenance**: fitur baru harus menjaga konsistensi DB dan Sheets path.

---

## 3. Roadmap Horizons

| Horizon | Fokus | Estimasi sifat pekerjaan |
|---|---|---|
| Near-Term | Stabilitas, test coverage, hardening, UX recovery | Kecil-menengah, risiko rendah-sedang |
| Mid-Term | Produktivitas user, export, template, alert, automasi | Menengah, membutuhkan desain UI/data |
| Long-Term | Ekspansi platform dan kolaborasi | Besar, butuh riset teknis/produk |

---

## 4. Current Product Baseline

BudgetIn v1.6.5 sudah memiliki fondasi berikut:

- Auth Google OAuth dan email/password.
- Hybrid storage PostgreSQL dan Google Sheets.
- Prompt transaksi natural language dengan Groq.
- Manual expense, income, dan transfer.
- Ledger-derived account balances.
- Account types dan akun/dompet.
- Budget bulanan dan rollover.
- Savings goals dengan contribution allocation.
- Recurring bills.
- Cashflow, calendar, dashboard, net worth.
- AI analyst dan prediction.
- Backup/restore JSON lintas storage.
- Google setup recovery/migration.
- Admin command center.
- Production changelog.
- Public SEO pages, metadata, robots, sitemap.

---

## 5. Success Metrics

| Metric | Why it matters | Direction |
|---|---|---|
| Prompt success rate | Mengukur kemampuan input natural language. | Increase |
| Manual transaction completion rate | Mengukur fallback input yang stabil. | Increase |
| Transaction correction/delete rate | Indikasi parsing/UX error. | Decrease |
| Active accounts per user | Mengukur adopsi account tracking. | Increase |
| Budget adoption rate | Mengukur value budget module. | Increase |
| Savings goal adoption rate | Mengukur value goal-based saving. | Increase |
| Google setup recovery completion | Mengukur keberhasilan Google user onboarding. | Increase |
| AI endpoint error rate | Mengukur reliability AI features. | Decrease |
| Sheets write/read failure rate | Mengukur reliability Google storage. | Decrease |
| Backup export/restore success | Mengukur data portability. | Increase |

---

## 6. Near-Term Roadmap

Near-term focus adalah membuat produk lebih stabil dan aman dikembangkan sebelum menambah fitur besar.

### 6.1 Improve Bills and Backup/Restore Test Coverage

**Problem**: Bills dan backup/restore menyentuh data penting, tetapi perlu test coverage lebih kuat agar aman saat refactor.

**Scope**:

- Tambah unit/integration tests untuk bill pay/skip/summary.
- Tambah tests untuk backup export schema.
- Tambah tests untuk backup preview validation.
- Tambah tests untuk restore edge cases DB dan Sheets-compatible target.
- Pastikan secrets/token tidak pernah masuk export.

**Success criteria**:

- Bills core behavior punya focused Jest coverage.
- Backup schema normalization punya regression tests.
- `npx tsc --noEmit` dan focused Jest tests pass.

**Dependencies**:

- `lib/backup.ts`
- `utils/bill-utils.ts`
- `app/api/bills/*`
- `app/api/backup/*`

**Priority**: P0

---

### 6.2 Fix Lint Script Compatibility

**Problem**: `npm run lint` saat ini bermasalah karena current Next CLI memperlakukan `lint` sebagai project directory invalid.

**Scope**:

- Audit script lint di `package.json`.
- Pilih pendekatan lint yang kompatibel dengan Next.js saat ini.
- Tambah dokumentasi command validasi yang benar.
- Pastikan tidak mengganggu build/typecheck.

**Success criteria**:

- Ada command lint yang bisa dijalankan lokal.
- Dokumentasi validasi di TDD/README selaras dengan command aktual.

**Dependencies**:

- `package.json`
- Next.js linting behavior
- ESLint config jika ditambahkan/diperbarui

**Priority**: P1

---

### 6.3 Add Rate Limiting for AI/Prompt Endpoints

**Problem**: Endpoint AI dan prompt bergantung pada layanan eksternal serta berpotensi mahal/slow jika disalahgunakan.

**Scope**:

- Rate limit `POST /api/record`.
- Rate limit `/api/analyst` dan `/api/prediction`.
- Tentukan limit untuk authenticated user.
- Return error message yang ramah user.
- Hindari memblokir transaksi manual non-AI.

**Success criteria**:

- Endpoint AI/prompt punya pembatasan request.
- User menerima pesan jelas ketika limit tercapai.
- Tidak ada regresi untuk flow manual transaction.

**Dependencies**:

- `app/api/record/route.ts`
- `app/api/analyst/route.ts`
- `app/api/prediction/route.ts`
- Platform/runtime storage untuk rate limit

**Priority**: P0

---

### 6.4 Improve Google Token Recovery UX

**Problem**: Google users dapat terblokir ketika token/scopes bermasalah atau Sheet setup belum lengkap.

**Scope**:

- Perjelas copy recovery Google permission.
- Tambah CTA reconnect yang konsisten di dashboard/error surfaces.
- Pastikan state `google_setup_required` mudah dipahami user.
- Tambah loading/error state saat migration preview/execute.
- Dokumentasikan recovery flow di runbook.

**Success criteria**:

- User tahu kenapa perlu reconnect Google.
- Recovery path tidak terasa seperti data hilang.
- Migration complete/mark-complete flow jelas.

**Dependencies**:

- `lib/auth.ts`
- Google setup recovery UI
- `app/api/google-setup-migration/route.ts`
- `lib/backup.ts`

**Priority**: P0

---

### 6.5 Strengthen Transaction Regression Suite

**Problem**: Core finance logic berubah cepat dan berdampak lintas dashboard, account, budget, analyst, dan Sheets/DB path.

**Scope**:

- Tambah tests untuk manual transfer DB vs Sheets representation.
- Tambah tests untuk signed income/expense correction aggregation.
- Tambah tests untuk date/time sorting.
- Tambah tests untuk account balance edge cases.
- Tambah regression test untuk savings contribution lifecycle.

**Success criteria**:

- Core transaction tests bisa dijalankan cepat dengan focused command.
- Transfer principal exclusion terjaga di dashboard/budget/analyst.

**Dependencies**:

- `lib/transaction-classification.ts`
- `utils/account-balance.ts`
- `lib/transaction-time.ts`
- `utils/record/*`

**Priority**: P0

---

## 7. Mid-Term Roadmap

Mid-term focus adalah meningkatkan produktivitas user dan memperluas use case tanpa mengorbankan correctness.

### 7.1 User-Configurable Timezone

**Problem**: Saat ini timezone utama adalah Asia/Jakarta, tetapi user di luar WIB butuh pencatatan waktu lokal.

**Scope**:

- Tambah timezone preference di user settings.
- Update transaction default time/date resolver.
- Update dashboard period boundaries.
- Update analyst/prediction period handling.
- Pastikan legacy users tetap default Asia/Jakarta.

**Success criteria**:

- User bisa memilih timezone.
- Transaksi baru mengikuti timezone user.
- Existing behavior tidak berubah untuk user tanpa preference.

**Dependencies**:

- `prisma/schema.prisma`
- `lib/transaction-time.ts`
- period filters in API/data helpers
- settings UI

**Priority**: P1

---

### 7.2 Export PDF/CSV

**Problem**: User membutuhkan output transaksi, dashboard, dan insight untuk arsip atau pelaporan pribadi.

**Scope**:

- Export CSV transaksi berdasarkan periode.
- Export budget realization CSV.
- Export analyst summary ke PDF atau printable view.
- Pastikan transfer principal tidak masuk expense total.
- Batasi ukuran export agar aman.

**Success criteria**:

- User bisa download CSV transaksi periode tertentu.
- Export summary mencerminkan angka yang sama dengan dashboard.
- Tidak ada data user lain yang ikut ter-export.

**Dependencies**:

- transaction read APIs
- analyst data APIs
- budget/cashflow helpers

**Priority**: P1

---

### 7.3 Budget Templates

**Problem**: Membuat budget dari nol setiap bulan dapat terasa repetitif.

**Scope**:

- Simpan template budget per user.
- Buat budget bulan baru dari template.
- Duplikasi budget dari bulan sebelumnya.
- UI preview sebelum apply.
- Support kategori rollover jika relevan.

**Success criteria**:

- User bisa membuat budget bulanan lebih cepat.
- Template tidak merusak budget existing tanpa konfirmasi.

**Dependencies**:

- Budget schema/API
- `lib/budget-data.ts`
- budget page UI

**Priority**: P2

---

### 7.4 Flexible Recurring Transaction Automation

**Problem**: Recurring bills sudah ada, tetapi use case transaksi rutin bisa lebih luas dari tagihan.

**Scope**:

- Define recurring expense/income/transfer templates.
- Support schedule fleksibel: monthly, weekly, custom day.
- Optional auto-create transaction.
- Preview upcoming recurring items.
- Manual confirm mode untuk menghindari salah catat.

**Success criteria**:

- User bisa mengelola transaksi rutin selain bills.
- Auto-record behavior transparan dan bisa dimatikan.

**Dependencies**:

- Existing bills model/API
- transaction write helpers
- cron behavior

**Priority**: P2

---

### 7.5 Budget Limit Alerts

**Problem**: User perlu tahu ketika spending mendekati/melebihi budget sebelum akhir bulan.

**Scope**:

- Alert threshold per kategori atau global default.
- Dashboard alert cards.
- Optional email notification.
- Alert state untuk avoid repeated spam.
- Transfer-safe spending calculation.

**Success criteria**:

- User melihat warning saat budget mendekati limit.
- Alert memakai angka yang sama dengan budget page.

**Dependencies**:

- budget data helpers
- notification/email infrastructure
- user settings

**Priority**: P1

---

### 7.6 Improved Financial Insights

**Problem**: AI analyst sudah tersedia, tetapi insight bisa lebih actionable dan terhubung ke data produk.

**Scope**:

- Tambah deterministic insight cards sebelum AI narrative.
- Detect unusual spending category.
- Detect recurring expense increase.
- Detect savings goal underfunding.
- Add clear next action buttons.

**Success criteria**:

- Insight tetap berguna saat Groq unavailable.
- AI narrative menambah konteks, bukan menggantikan metric.

**Dependencies**:

- `app/api/analyst/route.ts`
- `app/api/prediction/route.ts`
- dashboard/budget/savings data helpers

**Priority**: P1

---

## 8. Long-Term Roadmap

Long-term focus adalah perluasan platform, kolaborasi, dan input data skala lebih besar.

### 8.1 Multi-Language Support

**Problem**: Produk saat ini berfokus Bahasa Indonesia, tetapi dapat diperluas untuk user bilingual atau non-Indonesia.

**Scope**:

- Introduce i18n framework.
- Extract UI strings.
- Localize prompt examples.
- Adjust Groq prompt/classification by locale.
- Add language preference.

**Success criteria**:

- UI dapat berpindah minimal Indonesia/English.
- Prompt examples dan error messages mengikuti locale.

**Dependencies**:

- i18n architecture
- settings UI
- Groq prompt redesign

**Priority**: P3

---

### 8.2 Shared Household Budget

**Problem**: Banyak pengelolaan uang personal sebenarnya dilakukan bersama pasangan/keluarga.

**Scope**:

- Household/workspace model.
- Invite member.
- Role-based access inside household.
- Shared accounts/budgets with audit trail.
- Migration path dari personal user ke household.

**Success criteria**:

- Dua user bisa melihat/mengelola budget bersama sesuai role.
- Data personal dan shared tidak bocor silang.

**Dependencies**:

- Major schema redesign
- auth/session authorization model
- ownership checks across APIs

**Priority**: P3

---

### 8.3 Bank/E-Wallet Statement Import

**Problem**: Input manual/prompt tetap butuh effort untuk user dengan transaksi banyak.

**Scope**:

- CSV import for common bank/e-wallet exports.
- Column mapping wizard.
- Duplicate detection.
- Account/category inference.
- Preview before import.
- Rollback imported batch.

**Success criteria**:

- User dapat import statement tanpa duplikasi besar.
- Import tidak langsung menulis sebelum preview/confirm.

**Dependencies**:

- import parser layer
- duplicate detection algorithm
- account/category resolver reuse
- batch transaction write

**Priority**: P2

---

### 8.4 Native Mobile or Offline-First PWA

**Problem**: Transaction capture paling sering terjadi di mobile dan kadang perlu offline/low-connectivity support.

**Scope**:

- Evaluate PWA offline-first vs native mobile.
- Offline transaction draft queue.
- Conflict resolution strategy.
- Push notification support.
- Mobile-first capture UX.

**Success criteria**:

- User bisa mencatat draft transaksi saat offline.
- Sync tidak menyebabkan duplikasi/saldo salah.

**Dependencies**:

- service worker/storage strategy
- sync protocol
- conflict handling
- mobile UI redesign

**Priority**: P3

---

## 9. Product Backlog by Theme

### 9.1 Reliability and Correctness

| Item | Horizon | Priority |
|---|---|---|
| Bills tests | Near-Term | P0 |
| Backup/restore tests | Near-Term | P0 |
| Transaction regression suite | Near-Term | P0 |
| Google token recovery UX | Near-Term | P0 |
| Rate limiting AI endpoints | Near-Term | P0 |
| Lint script compatibility | Near-Term | P1 |

### 9.2 User Productivity

| Item | Horizon | Priority |
|---|---|---|
| CSV transaction export | Mid-Term | P1 |
| Analyst printable/PDF summary | Mid-Term | P1 |
| Budget limit alerts | Mid-Term | P1 |
| Budget templates | Mid-Term | P2 |
| Flexible recurring transaction automation | Mid-Term | P2 |
| Bank/e-wallet statement import | Long-Term | P2 |

### 9.3 Personalization and Scale

| Item | Horizon | Priority |
|---|---|---|
| User-configurable timezone | Mid-Term | P1 |
| Improved deterministic insights | Mid-Term | P1 |
| Multi-language support | Long-Term | P3 |
| Shared household budget | Long-Term | P3 |
| Offline-first PWA/native mobile | Long-Term | P3 |

---

## 10. Suggested Release Packaging

Version numbers must be confirmed before release commit/tag.

| Release candidate | Theme | Candidate scope |
|---|---|---|
| Patch release | Stability | Test additions, lint fix, Google recovery copy improvements. |
| Minor release | Safety and reliability | Rate limiting, stronger regression suite, backup/bills hardening. |
| Minor release | Export and alerts | CSV export, analyst printable view, budget limit alerts. |
| Minor release | Budget productivity | Budget templates and duplicate previous month. |
| Major or large minor | Collaboration/platform | Household budget, import pipeline, offline-first/mobile. |

---

## 11. Prioritization Framework

Use this scoring when evaluating new work:

| Factor | Score high when |
|---|---|
| User impact | Affects frequent workflows or high-value financial correctness. |
| Risk reduction | Prevents data loss, wrong balances, or broken Google/DB paths. |
| Effort | Can be implemented/tested with limited architectural change. |
| Strategic fit | Supports fast capture, financial correctness, and user-owned data. |
| Dependency unblock | Enables multiple future features. |

Recommended priority labels:

| Priority | Meaning |
|---|---|
| P0 | Needed soon for reliability, correctness, or production safety. |
| P1 | High-value improvement with clear user benefit. |
| P2 | Valuable but can wait behind P0/P1. |
| P3 | Strategic exploration or large initiative. |

---

## 12. Explicit Non-Goals for Current Planning Cycle

These are not current short-term priorities:

- Native mobile app before web/PWA strategy is clarified.
- Direct bank auto-sync with credentials/API aggregation.
- Crypto/investment portfolio tracking.
- Business accounting, invoicing, or tax reporting.
- Multi-tenant organization finance beyond household-style sharing.
- Replacing deterministic calculations with AI-generated numbers.

---

## 13. Documentation Follow-Up

Recommended next planning documents:

| Document | Purpose | Suggested filename |
|---|---|---|
| API Specification | Endpoint request/response/error docs. | `API.md` |
| ADR Index | Records of key architecture decisions. | `docs/adr/README.md` |
| QA/Test Plan | Regression checklist and test ownership. | `QA_PLAN.md` |
| Operational Runbook | Deploy, rollback, DB migration, Google recovery. | `RUNBOOK.md` |
| Release Plan | Scope and checklist per release. | `RELEASE_PLAN.md` |
