# Dashboard Performance & Email Injection Bugfix Design

## Overview

This design addresses two distinct bugs in BudgetIn:

1. **Dashboard Load Time Performance** — The current server-side cache (`React.cache()`) only deduplicates within a single request. There is no cross-request TTL cache, no stale-while-revalidate pattern on the client, no streaming/partial rendering for progressive display, and no optimistic updates after mutations. This causes unnecessary database/Sheets queries on every page load and slow perceived performance.

2. **Hyperlink Injection in Email Verification** — The `sendVerificationEmail` and `sendPasswordResetEmail` functions in `lib/email.ts` interpolate the user's `name` directly into HTML templates (`${name}`) without HTML entity escaping or input validation. An attacker can register with a name containing URLs or HTML tags, which email clients render as clickable hyperlinks or injected markup in official BudgetIn emails.

## Glossary

- **Bug_Condition (C)**: Two conditions — (1) Dashboard data requests without cross-request cache hit; (2) User name containing URL/HTML rendered unsanitized in email templates
- **Property (P)**: (1) Dashboard serves cached data within TTL and streams progressive content; (2) Email templates render user names as plain text without clickable links or injected HTML
- **Preservation**: (1) Data accuracy, mutation consistency, cross-tab sync, and budget calculations remain unchanged; (2) Normal names (including non-Latin characters) continue to display correctly in emails
- **`getCachedDashboardData`**: The function in `lib/cache.ts` that wraps `fetchDashboardData` with React `cache()` — currently only per-request deduplication
- **`sendVerificationEmail`**: The function in `lib/email.ts` that sends HTML verification emails with unsanitized `${name}` interpolation
- **`sendPasswordResetEmail`**: The function in `lib/email.ts` that sends HTML password reset emails with unsanitized `${name}` interpolation
- **TTL Cache**: Time-to-live cache that persists data across multiple HTTP requests for a configurable duration
- **SWR**: Stale-While-Revalidate — pattern where stale cached data is served immediately while fresh data is fetched in the background

---

## Bug Details

### Bug Condition 1: Dashboard Performance

The bug manifests when a user opens the dashboard or triggers a data refetch after mutation. The `getCachedDashboardData` function uses React `cache()` which only deduplicates within a single server render — it does NOT cache across separate HTTP requests. Every new page load triggers full database/Sheets queries regardless of whether data has changed.

On the client side, `DashboardClient.tsx` performs raw `fetch()` calls without stale-while-revalidate semantics — after mutations, it refetches all data endpoints (`/api/record`, `/api/budget`, `/api/accounts`) sequentially without showing stale data or performing optimistic updates.

**Formal Specification:**
```
FUNCTION isBugCondition_Performance(input)
  INPUT: input of type DashboardRequest
  OUTPUT: boolean
  
  RETURN (input.type == "page_load" AND NOT crossRequestCacheExists(input.userId))
         OR (input.type == "page_load" AND crossRequestCacheExpired(input.userId))
         OR (input.type == "mutation_refetch" AND noOptimisticUpdate(input.mutation))
         OR (input.type == "page_load" AND noStreamingRendering(input.page))
END FUNCTION
```

### Bug Condition 2: Email Hyperlink Injection

The bug manifests when a user registers with a name containing URLs, domains, or HTML markup. The `sendVerificationEmail` function directly interpolates `${name}` into the HTML template without any escaping. Email clients auto-link URLs in text content, and raw HTML tags are rendered as markup.

**Formal Specification:**
```
FUNCTION isBugCondition_EmailInjection(input)
  INPUT: input of type RegistrationInput
  OUTPUT: boolean
  
  RETURN (input.name CONTAINS urlPattern)
         OR (input.name CONTAINS htmlTagPattern)
         OR (input.name CONTAINS domainPattern)
  WHERE urlPattern = /(https?:\/\/|www\.)[^\s]+/
  WHERE htmlTagPattern = /<[a-zA-Z][^>]*>/
  WHERE domainPattern = /[a-zA-Z0-9-]+\.(com|net|org|io|xyz|[a-z]{2,})/
END FUNCTION
```

### Examples

**Dashboard Performance:**
- User opens dashboard → full Prisma query executes (500ms+) even though data hasn't changed in 10 seconds
- User adds a transaction → UI shows loading spinner while 3 sequential fetches complete (no optimistic update)
- Google Sheets user opens dashboard → full Sheets API call (1-3s) even though ledger hasn't changed
- Dashboard SSR → entire page blocked until all data resolves (high TTFB)

**Email Injection:**
- User registers with name `"klik disini evil.com"` → email displays "evil.com" as clickable hyperlink
- User registers with name `"<a href='https://phishing.com'>Verifikasi Ulang</a>"` → email renders injected link
- User registers with name `"Admin https://fake-budgetin.com/verify"` → email shows fake verification URL as clickable link
- User registers with name `"Budi Santoso"` → email correctly displays "Hai, Budi Santoso! 👋" (not a bug)

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Cold-start dashboard loads (no cache) must still display accurate, complete data from database/Sheets
- Mutations (add/edit/delete transaction, budget, account) must still result in consistent data after completion — cache must be invalidated correctly
- Cross-tab synchronization via BroadcastChannel must continue to work
- Google Sheets write operations must still invalidate cache and show fresh data
- Below-the-fold components must continue using dynamic imports with skeleton placeholders
- Semi-static cache profile for categories and account-types must remain unchanged
- Budget calculations (rollover, spent, unbudgeted) must produce identical results
- Normal names (letters, spaces, common punctuation, non-Latin scripts) must display correctly in emails
- Verification email links must remain valid and clickable
- Recurring reminder emails must display bill names correctly

**Scope:**
- Performance fix: All data accuracy, calculation logic, and synchronization behavior must be completely unaffected. Only the caching/delivery mechanism changes.
- Email fix: All legitimate names and email content must render identically. Only malicious/URL-containing names are affected.

---

## Hypothesized Root Cause

### Dashboard Performance

1. **No Cross-Request Cache**: `lib/cache.ts` uses React `cache()` which is scoped to a single server render. There is no TTL-based cache (e.g., `unstable_cache`, in-memory Map with expiry, or Redis) that persists data across separate HTTP requests.

2. **No Client-Side SWR**: `DashboardClient.tsx` uses raw `fetch()` calls without any stale-while-revalidate library (SWR, React Query, or manual implementation). After mutations, it triggers full refetches with loading states instead of showing stale data + background refresh.

3. **No Streaming/Suspense Boundaries**: The dashboard page uses a single `<Suspense>` boundary around `<DashboardData>`. All data must resolve before any content renders. There are no granular Suspense boundaries for progressive streaming of KPI cards vs. secondary data.

4. **No Optimistic Updates**: After recording a transaction, the client waits for server response and then refetches all data. There is no local state update before server confirmation.

5. **No ETag Utilization on Client**: `cache-headers.ts` defines profiles but the client `fetch()` calls don't send `If-None-Match` headers to leverage conditional responses.

### Email Hyperlink Injection

1. **No HTML Escaping**: `sendVerificationEmail` and `sendPasswordResetEmail` use template literals (`${name}`) to interpolate user input directly into HTML. Characters like `<`, `>`, `&`, `"`, `'` are not escaped.

2. **No Input Validation on Name Field**: The registration route (`app/api/auth/register/route.ts`) only checks `!name?.trim()` (non-empty). There is no validation against URL patterns, HTML tags, or suspicious characters.

3. **Email Client Auto-Linking**: Even without HTML tags, email clients (Gmail, Outlook) automatically convert text that looks like URLs/domains into clickable hyperlinks. Plain-text URLs in the name field become phishing vectors.

---

## Correctness Properties

Property 1: Bug Condition - Dashboard Cross-Request Cache

_For any_ dashboard page load where the user has previously loaded the dashboard within the TTL window (30-60 seconds) and no mutations have occurred, the system SHALL serve data from the cross-request cache without executing fresh database/Sheets queries, resulting in significantly reduced response time.

**Validates: Requirements 2.1, 2.3**

Property 2: Bug Condition - Client Stale-While-Revalidate

_For any_ client-side data refetch triggered by a mutation or page revisit, the system SHALL immediately display the last known (stale) data while performing a background refresh, ensuring the user never sees a full loading state for data that was previously available.

**Validates: Requirements 2.2, 2.5**

Property 3: Bug Condition - Email Name Sanitization

_For any_ user registration or password reset where the user's name contains URL patterns, domain names, or HTML markup, the system SHALL sanitize the name before rendering in email templates such that no clickable hyperlinks or injected HTML appear in the sent email.

**Validates: Requirements 5.1, 5.2, 5.3**

Property 4: Preservation - Data Accuracy After Cache

_For any_ dashboard load (cached or uncached), the displayed data SHALL be accurate and consistent with the database state — cache invalidation after mutations ensures no stale data persists beyond the intended TTL, and budget calculations remain identical.

**Validates: Requirements 3.1, 3.2, 3.4, 3.7**

Property 5: Preservation - Normal Name Display in Email

_For any_ user registration where the name contains only legitimate characters (letters, spaces, common punctuation, non-Latin scripts like Arabic, Chinese, Javanese), the system SHALL display the name correctly and completely in email templates without modification or rejection.

**Validates: Requirements 6.1, 6.2, 6.3**

---

## Fix Implementation

### Changes Required

#### Bug 1: Dashboard Performance

**File**: `lib/cache.ts`

**Specific Changes**:
1. **Add Cross-Request TTL Cache**: Implement a server-side cache using Next.js `unstable_cache` (or in-memory Map with TTL) that persists dashboard data across requests. Key by `userId`, TTL of 30-60 seconds.
2. **Cache Invalidation on Mutation**: Export an `invalidateDashboardCache(userId)` function that clears the user's cached data. Call this from mutation API routes (record, budget, accounts).

**File**: `app/dashboard/page.tsx`

**Specific Changes**:
3. **Granular Suspense Boundaries**: Split `<DashboardData>` into multiple async components with individual Suspense boundaries — KPI/summary data streams first, transaction history and budget details stream progressively.

**File**: `app/dashboard/DashboardClient.tsx`

**Specific Changes**:
4. **Stale-While-Revalidate Pattern**: Wrap client-side fetch calls with SWR semantics — show `initialData` (from server) immediately, refetch in background, update UI when fresh data arrives without showing loading spinners.
5. **Optimistic Updates**: After recording a transaction, immediately update local `transactions` state with the new entry before server confirmation. Rollback on error.
6. **ETag/Conditional Requests**: Send `If-None-Match` header with last known ETag on client fetches. Handle 304 responses by keeping current data.

#### Bug 2: Email Hyperlink Injection

**File**: `lib/email.ts`

**Specific Changes**:
1. **Add HTML Escape Utility**: Create a `escapeHtml(str)` function that escapes `<`, `>`, `&`, `"`, `'` to their HTML entity equivalents.
2. **Escape All User-Generated Content**: Apply `escapeHtml()` to `name` (and `billName`) before interpolation in all email templates: `sendVerificationEmail`, `sendPasswordResetEmail`, `sendRecurringReminderEmail`, `sendAutoRecordConfirmation`.

**File**: `app/api/auth/register/route.ts`

**Specific Changes**:
3. **Name Validation**: Add validation that rejects names containing URL patterns (`http://`, `https://`, `www.`), HTML tags (`<...>`), or names that consist primarily of non-name characters.
4. **Name Sanitization**: Strip or reject domain-like patterns (e.g., `evil.com`) from the name field. Allow legitimate names with periods (e.g., "Dr. Smith") but reject standalone domain patterns.

**File**: `lib/name-validation.ts` (new)

**Specific Changes**:
5. **Shared Validation Module**: Create a reusable name validation/sanitization module that can be used by registration, profile update, and any future name input endpoints.

---

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate both bugs BEFORE implementing fixes. Confirm or refute the root cause analysis.

**Test Plan — Dashboard Performance**:
Write tests that measure response times and verify cache behavior. Run on unfixed code to confirm no cross-request caching exists.

**Test Cases**:
1. **Repeated Load Test**: Call `getCachedDashboardData(userId)` twice in separate request contexts — verify both execute full queries (will show no caching on unfixed code)
2. **Post-Mutation Refetch Test**: Simulate a transaction creation followed by dashboard load — verify full refetch occurs with no optimistic update (will show loading delay on unfixed code)
3. **Sheets User Repeated Load**: Call dashboard data for a Sheets user twice — verify both hit Google Sheets API (will show redundant API calls on unfixed code)

**Test Plan — Email Injection**:
Write tests that register users with malicious names and inspect the generated email HTML.

**Test Cases**:
4. **URL in Name Test**: Register with name `"click evil.com"` — verify the email HTML contains the raw URL without escaping (will show injection on unfixed code)
5. **HTML Tag in Name Test**: Register with name `"<script>alert(1)</script>"` — verify the email HTML contains unescaped tags (will show injection on unfixed code)
6. **Domain Pattern Test**: Register with name `"admin https://phishing.com/verify"` — verify the email contains clickable link (will show injection on unfixed code)

**Expected Counterexamples**:
- Dashboard: Two sequential requests both execute full database queries (no cache hit)
- Email: HTML output contains raw `<a>` tags or auto-linkable URLs in the name position
- Possible causes confirmed: React `cache()` is per-request only; no `escapeHtml` applied to template interpolation

### Fix Checking

**Goal**: Verify that for all inputs where the bug conditions hold, the fixed functions produce the expected behavior.

**Pseudocode — Dashboard:**
```
FOR ALL request WHERE isBugCondition_Performance(request) DO
  result := getCachedDashboardData_fixed(request.userId)
  IF request.withinTTL AND NOT request.afterMutation THEN
    ASSERT result.source == "cache"
    ASSERT result.responseTime < freshQueryTime * 0.5
  END IF
  IF request.afterMutation THEN
    ASSERT result.data == latestDatabaseState
  END IF
END FOR
```

**Pseudocode — Email:**
```
FOR ALL input WHERE isBugCondition_EmailInjection(input) DO
  html := renderEmailTemplate_fixed(input.name)
  ASSERT NOT containsClickableLink(html, extractUrls(input.name))
  ASSERT NOT containsRawHtmlTags(html, input.name)
  ASSERT htmlEntitiesEscaped(html, input.name)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug conditions do NOT hold, the fixed functions produce the same results as the original functions.

**Pseudocode — Dashboard:**
```
FOR ALL request WHERE NOT isBugCondition_Performance(request) DO
  ASSERT fetchDashboardData_original(request) == fetchDashboardData_fixed(request)
  // Budget calculations, account balances, transaction sorting all identical
END FOR
```

**Pseudocode — Email:**
```
FOR ALL input WHERE NOT isBugCondition_EmailInjection(input) DO
  ASSERT renderEmailTemplate_original(input.name) == renderEmailTemplate_fixed(input.name)
  // Normal names render identically
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many random valid names (including non-Latin scripts) to verify email rendering is unchanged
- It generates many dashboard data configurations to verify calculations remain identical
- It catches edge cases in name validation (names with periods, hyphens, apostrophes)
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for normal inputs, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Budget Calculation Preservation**: Generate random transaction sets and verify `computeBudgetData` produces identical results with and without cache layer
2. **Normal Name Email Preservation**: Generate random legitimate names (Latin, non-Latin, with common punctuation) and verify email HTML output is identical before and after sanitization
3. **Cross-Tab Sync Preservation**: Verify BroadcastChannel events continue to trigger correctly after adding SWR layer
4. **Account Balance Preservation**: Verify account balance calculations remain identical when served from cache vs. fresh query

### Unit Tests

- Test `escapeHtml` function with all special characters (`<`, `>`, `&`, `"`, `'`)
- Test name validation regex against known malicious patterns and legitimate names
- Test cache TTL expiry and invalidation logic
- Test optimistic update rollback on server error
- Test ETag/304 handling in client fetch wrapper

### Property-Based Tests

- Generate random user names (Unicode, mixed scripts, punctuation) and verify: if name is valid, email renders correctly; if name contains URLs/HTML, it is rejected or escaped
- Generate random dashboard data states and verify: cached response equals fresh response within TTL; invalidated cache triggers fresh query
- Generate random transaction sequences and verify: budget calculations are identical whether data comes from cache or fresh query

### Integration Tests

- Full registration flow with malicious name → verify email received has no clickable injected links
- Dashboard load → mutation → dashboard reload → verify data is fresh and consistent
- Multiple rapid dashboard loads → verify only first triggers DB query, subsequent serve from cache
- Cache TTL expiry → verify next load triggers fresh query
- Google Sheets user dashboard load with cache → verify Sheets API not called within TTL
