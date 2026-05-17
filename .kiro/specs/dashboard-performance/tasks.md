# Implementation Plan

- [x] 1. Write bug condition exploration test — Dashboard Performance
  - **Property 1: Bug Condition** - Dashboard Cross-Request Cache Missing
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the dashboard performance bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases — repeated dashboard data requests within TTL window for the same userId should return cached results
  - Test that `getCachedDashboardData(userId)` called twice in separate request contexts both execute full database/Sheets queries (no cross-request caching)
  - Test that after a mutation, client refetch shows full loading state with no stale data displayed (no SWR pattern)
  - Test that Google Sheets user repeated loads both hit the Sheets API (no TTL cache)
  - The test assertions should match Expected Behavior Properties from design: cached response within TTL, SWR pattern on client, streaming progressive content
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the cache bug exists: every request triggers fresh queries)
  - Document counterexamples found (e.g., "Two requests 5s apart both execute full Prisma queries, response time identical to cold start")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [x] 2. Write bug condition exploration test — Email Hyperlink Injection
  - **Property 1: Bug Condition** - Email Name Sanitization Missing
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the email injection bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases — names containing URLs (`"click evil.com"`), HTML tags (`"<script>alert(1)</script>"`), and domain patterns (`"admin https://phishing.com/verify"`)
  - Test that `sendVerificationEmail` with name containing URL renders raw URL in HTML output (no escaping)
  - Test that `sendVerificationEmail` with name containing HTML tags renders unescaped tags in output
  - Test that `sendPasswordResetEmail` with name containing domain pattern renders auto-linkable text
  - The test assertions should match Expected Behavior: no clickable hyperlinks from name field, all HTML entities escaped, no injected markup
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the injection bug exists: names with URLs/HTML are rendered unsanitized)
  - Document counterexamples found (e.g., "`sendVerificationEmail('click evil.com', email)` produces HTML containing raw 'evil.com' without entity escaping")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3_

- [x] 3. Write preservation property tests — Dashboard Data Accuracy (BEFORE implementing fix)
  - **Property 2: Preservation** - Dashboard Data Accuracy and Calculation Integrity
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `fetchDashboardData(userId)` returns complete, accurate data on unfixed code (cold start behavior)
  - Observe: Budget calculations (`computeBudgetData`) produce correct rollover, spent, unbudgeted values on unfixed code
  - Observe: BroadcastChannel cross-tab sync triggers correctly on unfixed code
  - Observe: Account balance calculations remain consistent on unfixed code
  - Write property-based test: for all valid userId and transaction sets, `fetchDashboardData` returns identical results regardless of cache layer presence
  - Write property-based test: for all valid budget configurations, `computeBudgetData` produces identical calculations
  - Write property-based test: for all mutation events, BroadcastChannel dispatches correct sync events
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 4. Write preservation property tests — Normal Name Email Rendering (BEFORE implementing fix)
  - **Property 2: Preservation** - Normal Name Display in Email Templates
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `sendVerificationEmail("Budi Santoso", email)` renders "Hai, Budi Santoso! 👋" correctly on unfixed code
  - Observe: `sendVerificationEmail("Dr. Smith", email)` renders name with period correctly on unfixed code
  - Observe: `sendVerificationEmail("محمد", email)` renders Arabic name correctly on unfixed code
  - Observe: `sendVerificationEmail("田中太郎", email)` renders CJK name correctly on unfixed code
  - Observe: `sendRecurringReminderEmail` renders bill names correctly on unfixed code
  - Write property-based test: for all legitimate names (Latin letters, non-Latin scripts, common punctuation like `.`, `,`, `'`, `-`), email HTML output contains the name rendered correctly and completely
  - Write property-based test: for all legitimate names, verification link in email remains valid and clickable
  - Write property-based test: for all legitimate bill names, recurring reminder email renders bill name correctly
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 5. Fix for Dashboard Performance — Server-Side Cross-Request Cache

  - [x] 5.1 Implement cross-request TTL cache in `lib/cache.ts`
    - Add TTL-based cache layer (using `unstable_cache` or in-memory Map with expiry) wrapping `fetchDashboardData`
    - Key cache by `userId`, set TTL to 30-60 seconds
    - Export `invalidateDashboardCache(userId)` function for mutation endpoints
    - Ensure cold-start (no cache) still executes fresh query and returns complete data
    - _Bug_Condition: isBugCondition_Performance(input) where input.type == "page_load" AND NOT crossRequestCacheExists(input.userId)_
    - _Expected_Behavior: result.source == "cache" when within TTL and no mutations occurred_
    - _Preservation: Cold-start loads must still display accurate, complete data; budget calculations must be identical_
    - _Requirements: 2.1, 2.3, 3.1, 3.6, 3.7_

  - [x] 5.2 Add cache invalidation to mutation API routes
    - Call `invalidateDashboardCache(userId)` in `/api/record` POST/PUT/DELETE handlers
    - Call `invalidateDashboardCache(userId)` in `/api/budget` POST/PUT/DELETE handlers
    - Call `invalidateDashboardCache(userId)` in `/api/accounts` POST/PUT/DELETE handlers
    - Ensure Google Sheets write operations also invalidate cache
    - _Bug_Condition: isBugCondition_Performance(input) where input.type == "mutation_refetch"_
    - _Expected_Behavior: After mutation, cache is invalidated and next load returns fresh data_
    - _Preservation: Mutations must still result in consistent data after completion; cross-tab sync must continue working_
    - _Requirements: 2.1, 3.2, 3.3, 3.4_

  - [x] 5.3 Implement granular Suspense boundaries in `app/dashboard/page.tsx`
    - Split `<DashboardData>` into multiple async components with individual Suspense boundaries
    - KPI/summary data (today's summary, net worth) streams first with own Suspense boundary
    - Transaction history and budget details stream progressively with separate Suspense boundaries
    - Maintain existing dynamic imports and skeleton placeholders for below-the-fold components
    - _Bug_Condition: isBugCondition_Performance(input) where input.type == "page_load" AND noStreamingRendering(input.page)_
    - _Expected_Behavior: KPI data renders before secondary data resolves; reduced TTFB_
    - _Preservation: Below-the-fold components must continue using dynamic imports with skeleton placeholders_
    - _Requirements: 2.4, 3.5_

  - [x] 5.4 Implement SWR pattern and optimistic updates in `app/dashboard/DashboardClient.tsx`
    - Wrap client-side fetch calls with stale-while-revalidate semantics (show `initialData` from server immediately, refetch in background)
    - Implement optimistic updates: after recording a transaction, immediately update local state before server confirmation
    - Add rollback logic on server error for optimistic updates
    - Send `If-None-Match` header with last known ETag on client fetches; handle 304 responses
    - Ensure BroadcastChannel cross-tab sync continues to work with SWR layer
    - _Bug_Condition: isBugCondition_Performance(input) where input.type == "mutation_refetch" AND noOptimisticUpdate(input.mutation)_
    - _Expected_Behavior: Stale data shown immediately, background refresh updates UI without loading spinners; optimistic update provides instant feedback_
    - _Preservation: Cross-tab synchronization via BroadcastChannel must continue to work; data must be consistent after mutations complete_
    - _Requirements: 2.2, 2.5, 2.6, 3.2, 3.3_

  - [x] 5.5 Verify dashboard bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Dashboard Cross-Request Cache Working
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior (cached responses within TTL, SWR pattern, streaming)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms dashboard performance bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 5.6 Verify dashboard preservation tests still pass
    - **Property 2: Preservation** - Dashboard Data Accuracy and Calculation Integrity
    - **IMPORTANT**: Re-run the SAME tests from task 3 — do NOT write new tests
    - Run preservation property tests from step 3
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in data accuracy, budget calculations, cross-tab sync)
    - Confirm all dashboard preservation tests still pass after fix (no regressions)

- [x] 6. Fix for Email Hyperlink Injection — Name Sanitization

  - [x] 6.1 Create shared name validation module `lib/name-validation.ts`
    - Create `validateName(name: string)` function that rejects names containing URL patterns (`http://`, `https://`, `www.`), HTML tags (`<...>`), or standalone domain patterns
    - Allow legitimate names with periods (e.g., "Dr. Smith"), hyphens, apostrophes, and non-Latin scripts
    - Return clear error messages for rejected names
    - Create `sanitizeName(name: string)` function that strips dangerous patterns as a defense-in-depth layer
    - _Bug_Condition: isBugCondition_EmailInjection(input) where input.name CONTAINS urlPattern OR htmlTagPattern OR domainPattern_
    - _Expected_Behavior: Names with URLs/HTML/domains are rejected at registration or sanitized before email rendering_
    - _Preservation: Normal names (letters, spaces, common punctuation, non-Latin scripts) must be accepted without modification_
    - _Requirements: 5.1, 5.4, 6.1, 6.2_

  - [x] 6.2 Add HTML escape utility and apply to email templates in `lib/email.ts`
    - Create `escapeHtml(str: string)` function that escapes `<`, `>`, `&`, `"`, `'` to HTML entity equivalents
    - Apply `escapeHtml()` to `name` before interpolation in `sendVerificationEmail`
    - Apply `escapeHtml()` to `name` before interpolation in `sendPasswordResetEmail`
    - Apply `escapeHtml()` to `name` and `billName` before interpolation in `sendRecurringReminderEmail`
    - Apply `escapeHtml()` to `name` before interpolation in `sendAutoRecordConfirmation`
    - _Bug_Condition: isBugCondition_EmailInjection(input) where input.name rendered unsanitized in HTML template_
    - _Expected_Behavior: All user-generated content is HTML-escaped; no clickable hyperlinks or injected HTML from name field_
    - _Preservation: Normal names must display correctly; verification links must remain valid and clickable_
    - _Requirements: 5.2, 5.3, 6.1, 6.3, 6.4_

  - [x] 6.3 Add name validation to registration route `app/api/auth/register/route.ts`
    - Import and use `validateName` from `lib/name-validation.ts`
    - Reject registration attempts with names containing URL patterns, HTML tags, or suspicious domain patterns
    - Return clear error message (e.g., "Nama tidak valid. Silakan gunakan nama asli Anda.")
    - Ensure legitimate names (including non-Latin characters) pass validation
    - _Bug_Condition: isBugCondition_EmailInjection(input) where input.name passes current validation (only non-empty check)_
    - _Expected_Behavior: Names with URLs/HTML/domains are rejected with clear error before account creation_
    - _Preservation: Normal names must be accepted; registration flow must work correctly for legitimate users_
    - _Requirements: 5.1, 5.4, 6.1, 6.2_

  - [x] 6.4 Verify email injection bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Email Name Sanitization Working
    - **IMPORTANT**: Re-run the SAME test from task 2 — do NOT write a new test
    - The test from task 2 encodes the expected behavior (no clickable links, HTML entities escaped, no injected markup)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 2
    - **EXPECTED OUTCOME**: Test PASSES (confirms email injection bug is fixed)
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 6.5 Verify email preservation tests still pass
    - **Property 2: Preservation** - Normal Name Display in Email Templates
    - **IMPORTANT**: Re-run the SAME tests from task 4 — do NOT write new tests
    - Run preservation property tests from step 4
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in normal name display, verification links, recurring reminders)
    - Confirm all email preservation tests still pass after fix (no regressions)

- [x] 7. Checkpoint — Ensure all tests pass
  - Run full test suite to confirm all exploration tests (tasks 1, 2) now pass after fixes
  - Run full test suite to confirm all preservation tests (tasks 3, 4) still pass after fixes
  - Verify no regressions in existing test suite
  - Ensure all tests pass, ask the user if questions arise
