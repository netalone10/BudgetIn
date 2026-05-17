# Requirements Document

## Introduction

Comprehensive performance optimization for the BudgetIn application covering caching and data fetching, bundle size reduction, database and API query optimization, and performance monitoring. The scope includes all public pages, the dashboard, and sub-pages (transactions, budget, cashflow, savings, reports, etc.). The application uses Next.js 16 with React 19 App Router, Prisma ORM with PostgreSQL, and a dual-storage backend with Google Sheets.

## Glossary

- **Application**: The BudgetIn Next.js 16 web application deployed on Vercel
- **Cache_Layer**: The server-side caching mechanism using React `cache()` and `unstable_cache` for deduplicating and reusing data fetches within a single request or across requests
- **Bundle_Analyzer**: Tooling that measures and reports JavaScript bundle sizes per route
- **Dashboard_Page**: The primary authenticated page at `/dashboard` that displays transactions, budgets, accounts, and savings data
- **Prisma_Client**: The database ORM client used to query PostgreSQL
- **Google_Sheets_API**: The external API used to read/write financial data for Google-connected users
- **Core_Web_Vitals**: Google's standardized metrics (LCP, INP, CLS) measuring real-world user experience
- **Heavy_Dependencies**: Third-party packages exceeding 50KB gzipped: framer-motion, groq-sdk, html2canvas, jspdf, @googleapis/sheets
- **Route_Segment**: A Next.js App Router page or layout segment that can be independently code-split
- **API_Route**: A server-side endpoint under `/app/api/` handling client requests
- **Connection_Pool**: The pgbouncer-managed pool of PostgreSQL connections used by Prisma_Client at runtime
- **SWR_Pattern**: Stale-While-Revalidate caching strategy that serves cached data while fetching fresh data in the background

## Requirements

### Requirement 1: Server-Side Data Fetch Deduplication

**User Story:** As a user navigating the dashboard, I want pages to load quickly, so that I do not wait for redundant database queries to complete.

#### Acceptance Criteria

1. WHEN the Dashboard_Page renders, THE Cache_Layer SHALL deduplicate identical Prisma_Client queries made within the same server request lifecycle.
2. WHEN multiple Server Components in a single request call the same data-fetching function with identical parameters, THE Cache_Layer SHALL execute the underlying query only once and share the result.
3. THE Cache_Layer SHALL wrap all shared data-fetching functions (fetchDashboardData, fetchCategories, fetchAccounts) with React `cache()` to enable per-request memoization.

### Requirement 2: HTTP Cache Headers for Static and Semi-Static Content

**User Story:** As a returning user, I want previously loaded assets and data to be served from cache, so that page transitions feel instant.

#### Acceptance Criteria

1. THE Application SHALL serve static assets (JS bundles, CSS, images, fonts) with a `Cache-Control` header containing `public, max-age=31536000, immutable`.
2. WHEN an API_Route returns data that changes infrequently (categories, account types), THE API_Route SHALL include a `Cache-Control` header with `public, s-maxage=60, stale-while-revalidate=300`.
3. WHEN an API_Route returns user-specific mutable data (transactions, budgets), THE API_Route SHALL include a `Cache-Control` header with `private, no-cache` to prevent stale shared caches.
4. THE Application SHALL configure Next.js route segment caching with appropriate `revalidate` values for each dashboard sub-page.

### Requirement 3: Client-Side SWR Caching Pattern

**User Story:** As a user performing actions on the dashboard, I want data to update optimistically and revalidate in the background, so that the interface feels responsive.

#### Acceptance Criteria

1. WHEN the client fetches data from an API_Route, THE Application SHALL use a SWR_Pattern that returns cached data immediately and revalidates in the background.
2. WHEN a user creates, updates, or deletes a transaction, THE Application SHALL optimistically update the local cache before the server confirms the mutation.
3. IF a background revalidation fails, THEN THE Application SHALL retry the fetch up to 3 times with exponential backoff before showing an error state.
4. THE Application SHALL deduplicate concurrent identical client-side fetch requests to the same API_Route endpoint.

### Requirement 4: Bundle Size Reduction via Code Splitting

**User Story:** As a user on a slow connection, I want only the code needed for the current page to load, so that initial page load is fast.

#### Acceptance Criteria

1. THE Application SHALL dynamically import Heavy_Dependencies (html2canvas, jspdf, groq-sdk, @googleapis/sheets) only when the user triggers the feature that requires the dependency.
2. WHEN the user navigates to the reports page, THE Application SHALL load html2canvas and jspdf via dynamic import at the point of PDF generation, not at page load.
3. WHEN the user triggers AI analysis, THE Application SHALL load groq-sdk via dynamic import at invocation time, not at page load.
4. THE Application SHALL configure framer-motion imports to use subpath imports (`framer-motion/m`) or lazy-loaded feature bundles to reduce the initial client JavaScript payload.
5. THE Application SHALL add framer-motion to the `optimizePackageImports` list in the Next.js configuration.

### Requirement 5: Tree Shaking and Dead Code Elimination

**User Story:** As a developer, I want unused library code excluded from production bundles, so that users download only what the application uses.

#### Acceptance Criteria

1. THE Application SHALL use named imports from date-fns, date-fns-tz, and lucide-react to enable tree shaking of unused functions and icons.
2. THE Application SHALL avoid barrel file re-exports that prevent tree shaking of Heavy_Dependencies.
3. WHEN the production build completes, THE Bundle_Analyzer SHALL report that no individual route bundle exceeds 200KB gzipped for first-load JavaScript.

### Requirement 6: Prisma Query Optimization

**User Story:** As a user with many transactions, I want the dashboard to load within an acceptable time, so that I can review my finances without delay.

#### Acceptance Criteria

1. WHEN the Dashboard_Page fetches transaction data for a given month, THE Prisma_Client SHALL use a single query with appropriate `where` filters and `select` clauses to retrieve only the required fields.
2. THE Prisma_Client SHALL use `select` instead of full model retrieval for all dashboard queries to minimize data transfer from the database.
3. WHEN multiple independent queries are needed for a single page render, THE Application SHALL execute the queries in parallel using `Promise.all` or Prisma batch transactions.
4. THE Application SHALL limit transaction result sets to a maximum of 200 records per page load, using cursor-based or offset pagination for additional records.

### Requirement 7: Database Index Coverage

**User Story:** As a user with a large transaction history, I want queries to remain fast regardless of data volume, so that the application scales with my usage.

#### Acceptance Criteria

1. THE Prisma_Client schema SHALL maintain composite indexes on the Transaction model covering the query patterns: (userId, date), (userId, accountId, date), and (userId, type, date).
2. THE Prisma_Client schema SHALL maintain a composite index on the Budget model covering the query pattern (userId, month).
3. THE Prisma_Client schema SHALL maintain a composite index on the SavingsContribution model covering the query pattern (userId, goalId).
4. WHEN a new query pattern is introduced that filters on unindexed columns, THE Application SHALL add a corresponding database index before deploying the query to production.

### Requirement 8: Google Sheets API Roundtrip Reduction

**User Story:** As a Google-connected user, I want my dashboard to load without excessive external API calls, so that page load is not bottlenecked by network latency to Google.

#### Acceptance Criteria

1. WHEN the Dashboard_Page loads for a Google Sheets user, THE Application SHALL fetch the full transaction ledger in a single Google_Sheets_API call and derive month-specific slices in memory.
2. THE Application SHALL reuse preloaded transaction data when computing account balances, avoiding a separate Google_Sheets_API roundtrip for balance calculation.
3. WHEN the Google_Sheets_API returns data, THE Cache_Layer SHALL cache the response for the duration of the server request to prevent duplicate calls within the same render.
4. IF the Google_Sheets_API call fails, THEN THE Application SHALL return cached stale data from the previous successful fetch when available, or return an empty dataset with an error indicator.

### Requirement 9: Connection Pool Configuration

**User Story:** As a system administrator, I want database connections managed efficiently, so that the application handles concurrent users without connection exhaustion.

#### Acceptance Criteria

1. THE Prisma_Client SHALL connect through pgbouncer (connection pooler) for all runtime queries using the `DATABASE_URL` environment variable.
2. THE Prisma_Client SHALL use the `DIRECT_URL` for schema migrations and introspection only.
3. THE Application SHALL configure the Prisma connection pool size appropriate for the Vercel serverless environment (connection_limit parameter in the database URL).
4. IF the Connection_Pool is exhausted, THEN THE Prisma_Client SHALL queue the request and retry within 10 seconds before returning a connection timeout error.

### Requirement 10: Lighthouse CI Performance Thresholds

**User Story:** As a developer, I want automated performance regression detection, so that deployments do not degrade user experience.

#### Acceptance Criteria

1. THE Application SHALL include a Lighthouse CI configuration that runs on every pull request or deployment preview.
2. THE Application SHALL enforce a minimum Lighthouse Performance score of 80 for the landing page (`/`).
3. THE Application SHALL enforce a minimum Lighthouse Performance score of 70 for the authenticated Dashboard_Page.
4. IF a Lighthouse CI run produces a Performance score below the configured threshold, THEN THE Application SHALL fail the CI check and block the deployment.

### Requirement 11: Core Web Vitals Monitoring

**User Story:** As a product owner, I want real-time visibility into user-perceived performance, so that I can identify and address performance regressions.

#### Acceptance Criteria

1. THE Application SHALL report Largest Contentful Paint (LCP), Interaction to Next Paint (INP), and Cumulative Layout Shift (CLS) metrics to the analytics platform.
2. THE Application SHALL maintain LCP below 2500ms for the 75th percentile of page loads.
3. THE Application SHALL maintain INP below 200ms for the 75th percentile of interactions.
4. THE Application SHALL maintain CLS below 0.1 for the 75th percentile of page loads.
5. WHEN a Core_Web_Vitals metric exceeds the defined threshold for 24 consecutive hours, THE Application SHALL surface the regression in the analytics dashboard.

### Requirement 12: Custom Performance Timing Metrics

**User Story:** As a developer, I want to measure the duration of key user flows, so that I can identify bottlenecks specific to BudgetIn functionality.

#### Acceptance Criteria

1. THE Application SHALL measure and report the time from navigation start to dashboard data fully rendered (Time to Interactive for Dashboard).
2. THE Application SHALL measure and report the duration of transaction creation flow from form submission to confirmed persistence.
3. THE Application SHALL measure and report the duration of report PDF generation from user click to download initiation.
4. THE Application SHALL measure and report the duration of Google_Sheets_API synchronization operations.
5. WHEN any custom timing metric exceeds its defined threshold, THE Application SHALL log a performance warning with the metric name, measured duration, and threshold value.

### Requirement 13: Lazy Loading of Below-the-Fold Components

**User Story:** As a user, I want the visible content to appear first, so that I can start interacting with the page while secondary content loads.

#### Acceptance Criteria

1. WHEN the Dashboard_Page renders, THE Application SHALL prioritize loading above-the-fold components (summary cards, primary chart) before loading below-the-fold components (transaction list, budget breakdown).
2. THE Application SHALL use React `lazy()` with `Suspense` boundaries for dashboard sections that are not visible in the initial viewport.
3. THE Application SHALL dynamically import modal and dialog components (ManualTransactionForm, report generators) only when the user triggers the opening action.
4. WHILE a lazily-loaded component is loading, THE Application SHALL display a skeleton placeholder matching the component's expected dimensions to prevent layout shift.

### Requirement 14: Image and Font Optimization

**User Story:** As a user, I want media assets to load efficiently, so that they do not block page rendering or consume excessive bandwidth.

#### Acceptance Criteria

1. THE Application SHALL use the Next.js `<Image>` component for all raster images to enable automatic format negotiation (WebP/AVIF), resizing, and lazy loading.
2. THE Application SHALL preload the primary font (Geist) using `next/font` to eliminate font-swap layout shift.
3. THE Application SHALL set `font-display: swap` for all custom fonts to ensure text remains visible during font loading.
4. WHEN user profile images are loaded from Google (lh3.googleusercontent.com), THE Application SHALL specify explicit `width` and `height` attributes to reserve layout space.

### Requirement 15: API Route Response Optimization

**User Story:** As a client application, I want API responses to be minimal and fast, so that network transfer time is reduced.

#### Acceptance Criteria

1. THE API_Route handlers SHALL return only the fields required by the consuming client component, using Prisma `select` to avoid over-fetching from the database.
2. WHEN an API_Route returns a list of records, THE API_Route SHALL support pagination parameters (page, limit) with a default limit of 50 records.
3. THE API_Route handlers SHALL return appropriate HTTP status codes (200, 201, 400, 401, 404, 500) without including stack traces or internal error details in production responses.
4. WHEN an API_Route receives a request with an `If-None-Match` header matching the current ETag, THE API_Route SHALL return a 304 Not Modified response without a body.
