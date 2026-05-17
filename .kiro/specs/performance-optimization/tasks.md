# Implementation Plan: Performance Optimization

## Overview

Implement comprehensive performance optimization for BudgetIn across three layers: caching (server-side deduplication, HTTP headers, client SWR), bundle optimization (dynamic imports, tree shaking, lazy loading), and monitoring (Core Web Vitals, custom metrics, Lighthouse CI). Each task builds incrementally, starting with shared utilities and progressing to integration.

## Tasks

- [x] 1. Set up core caching utilities
  - [x] 1.1 Create server-side cache layer with React `cache()` wrappers
    - Create `lib/cache.ts` with `getCachedDashboardData`, `getCachedCategories`, `getCachedAccounts` functions wrapped in React `cache()`
    - Use Prisma `select` clauses to fetch only required fields
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 Create cache header utility
    - Create `lib/cache-headers.ts` with `CacheProfile` type, `getCacheControlHeader` function, and `ROUTE_CACHE_PROFILES` map
    - Implement static (immutable), semi-static (s-maxage=60, swr=300), and private-mutable (no-cache) profiles
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 1.3 Write property test for cache header classification (Property 1)
    - **Property 1: Cache Header Classification Correctness**
    - For any API route with a defined cache profile, verify the correct Cache-Control header string is returned
    - **Validates: Requirements 2.2, 2.3**

  - [x] 1.4 Create ETag utility
    - Create `lib/etag.ts` with `generateETag` (MD5-based) and `shouldReturn304` functions
    - Handle both strong and weak ETag comparison
    - _Requirements: 15.4_

  - [x] 1.5 Write property test for ETag conditional response (Property 8)
    - **Property 8: ETag Conditional Response**
    - Verify deterministic ETag generation and correct 304 matching logic
    - **Validates: Requirements 15.4**

- [x] 2. Implement pagination and query optimization
  - [x] 2.1 Create pagination utility
    - Create `lib/pagination.ts` with `normalizePaginationParams` and `paginateArray` functions
    - Enforce default limit of 50, max limit of 200, page minimum of 1
    - _Requirements: 6.4, 15.2_

  - [x] 2.2 Write property test for pagination limit enforcement (Property 4)
    - **Property 4: Pagination Limit Enforcement**
    - For any pagination parameters, verify limit never exceeds MAX_LIMIT and data array length respects the limit
    - **Validates: Requirements 6.4, 15.2**

  - [x] 2.3 Create transaction query builder
    - Create `lib/query-builder.ts` with `buildTransactionQuery` function
    - Compute correct first/last day of month for date range filters
    - Use `TRANSACTION_SELECT_FIELDS` constant for field selection, enforce `take: 200`
    - _Requirements: 6.1, 6.2_

  - [x] 2.4 Write property test for transaction query date range (Property 3)
    - **Property 3: Transaction Query Builder Date Range Correctness**
    - For any valid YYYY-MM month string, verify the query produces correct date boundaries
    - **Validates: Requirements 6.1**

- [x] 3. Implement API error handling and response optimization
  - [x] 3.1 Create API error handler
    - Create `lib/api-error.ts` with `createApiError` and `sanitizeErrorForProduction` functions
    - Map error types to HTTP status codes (400, 401, 403, 404, 500)
    - Never expose stack traces in production mode
    - _Requirements: 15.3_

  - [x] 3.2 Write property test for API error sanitization (Property 7)
    - **Property 7: API Error Response Sanitization**
    - For any error type in production mode, verify correct status code and no internal details leaked
    - **Validates: Requirements 15.3**

  - [x] 3.3 Create API response helpers with cache headers and ETag support
    - Create `lib/api-helpers.ts` with `withCacheHeaders`, `withETag`, and `handleConditionalRequest` functions
    - Integrate cache-headers and etag utilities into a unified API response pipeline
    - _Requirements: 2.2, 2.3, 15.4_

- [x] 4. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement client-side SWR and optimistic updates
  - [x] 5.1 Create SWR hook with retry and deduplication
    - Create `lib/hooks/use-api.ts` with `useApi` hook using SWR
    - Configure `dedupingInterval: 2000`, `errorRetryCount: 3`, exponential backoff
    - _Requirements: 3.1, 3.3, 3.4_

  - [x] 5.2 Implement optimistic mutation support
    - Add `useOptimisticMutation` hook and `applyOptimisticUpdate` utility to `lib/hooks/use-api.ts`
    - Support create (add item), update (modify item), delete (remove item) mutation types with rollback
    - _Requirements: 3.2_

  - [x] 5.3 Write property test for optimistic cache mutation consistency (Property 2)
    - **Property 2: Optimistic Cache Mutation Consistency**
    - For any valid transaction data and mutation type, verify array length and content changes correctly
    - **Validates: Requirements 3.2**

- [x] 6. Implement Google Sheets fallback and caching
  - [x] 6.1 Create Google Sheets fallback handler
    - Create `lib/sheets-fallback.ts` with `handleSheetsFallback` and `cacheSheetResponse` functions
    - Implement in-memory cache with 5-minute TTL for stale data serving
    - Return stale data with `isStale: true` on cache hit, empty data on cache miss
    - _Requirements: 8.3, 8.4_

  - [x] 6.2 Write property test for Google Sheets fallback (Property 5)
    - **Property 5: Google Sheets API Fallback Graceful Degradation**
    - For any API error and user ID, verify correct fallback behavior and error reporting
    - **Validates: Requirements 8.4**

  - [x] 6.3 Refactor Google Sheets data fetching to single-call pattern
    - Modify the existing Google Sheets integration to fetch the full ledger in one call
    - Derive month-specific slices in memory, reuse data for balance calculations
    - Wrap with React `cache()` for per-request deduplication
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 7. Implement bundle optimization and dynamic imports
  - [x] 7.1 Create dynamic import wrappers for heavy dependencies
    - Create `lib/dynamic-imports.ts` with `generatePDF` (html2canvas + jspdf) and `analyzeWithAI` (groq-sdk) wrappers
    - Each function loads its dependencies only at invocation time via `import()`
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 7.2 Update Next.js config for package optimization
    - Add `framer-motion` to `optimizePackageImports` in `next.config.ts`
    - Ensure `lucide-react`, `date-fns`, `date-fns-tz` are also in the list
    - _Requirements: 4.5, 5.1_

  - [x] 7.3 Refactor framer-motion imports to use subpath imports
    - Replace direct `framer-motion` imports with `framer-motion/m` or lazy-loaded feature bundles across components
    - Eliminate barrel file re-exports that prevent tree shaking
    - _Requirements: 4.4, 5.2_

  - [x] 7.4 Implement lazy loading for below-the-fold dashboard components
    - Wrap below-fold sections (transaction list, budget breakdown) with `React.lazy()` + `Suspense`
    - Add skeleton placeholders matching expected component dimensions
    - Dynamically import modal/dialog components (ManualTransactionForm, report generators) on trigger
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [x] 8. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement performance monitoring
  - [x] 9.1 Create performance measurement utility
    - Create `lib/performance.ts` with `measureTiming`, `checkThresholdBreach`, and threshold constants
    - Define thresholds: dashboard-tti (3000ms), transaction-create (2000ms), pdf-generation (10000ms), sheets-sync (5000ms)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 9.2 Write property test for performance threshold breach detection (Property 6)
    - **Property 6: Performance Threshold Breach Detection**
    - For any metric with a defined threshold, verify null when within threshold and warning object when exceeded
    - **Validates: Requirements 11.5, 12.5**

  - [x] 9.3 Integrate Core Web Vitals reporting
    - Set up `@vercel/analytics` or `web-vitals` library to report LCP, INP, and CLS metrics
    - Add `reportWebVitals` function to the app layout
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] 9.4 Add custom performance timing to key user flows
    - Instrument dashboard data load (Time to Interactive), transaction creation, PDF generation, and Sheets sync with `measureTiming`
    - Log threshold breach warnings when metrics exceed defined limits
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 10. Implement database optimization
  - [x] 10.1 Add missing database index for Budget model
    - Add `@@index([userId, month])` composite index to the Budget model in `prisma/schema.prisma`
    - Generate and apply migration
    - _Requirements: 7.2_

  - [x] 10.2 Refactor dashboard queries to use parallel execution and select-only
    - Update dashboard data fetching to use `Promise.all` for independent queries
    - Ensure all queries use Prisma `select` instead of full model retrieval
    - Apply the cached query functions from `lib/cache.ts`
    - _Requirements: 6.2, 6.3_

  - [x] 10.3 Configure Prisma connection pooling for Vercel serverless
    - Verify `DATABASE_URL` uses pgbouncer with appropriate `connection_limit` parameter
    - Verify `DIRECT_URL` is used only for migrations in `prisma/schema.prisma`
    - Document connection pool configuration
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 11. Implement image, font, and Lighthouse CI configuration
  - [x] 11.1 Audit and fix image and font optimization
    - Ensure all raster images use Next.js `<Image>` component with explicit width/height
    - Verify `next/font` preloads Geist font with `font-display: swap`
    - Add explicit dimensions to Google profile images
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [x] 11.2 Create Lighthouse CI configuration
    - Create `lighthouserc.js` with performance thresholds: 80 for landing page, 70 for dashboard
    - Configure 3 runs with median aggregation
    - Set up temporary public storage for reports
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 12. Wire API routes with caching, pagination, and error handling
  - [x] 12.1 Apply cache headers and pagination to API routes
    - Update API route handlers to use `withCacheHeaders` based on `ROUTE_CACHE_PROFILES`
    - Add pagination support (page, limit params) with default 50 to list endpoints
    - Integrate ETag generation and 304 conditional responses
    - _Requirements: 2.2, 2.3, 2.4, 15.1, 15.2, 15.4_

  - [x] 12.2 Apply error sanitization to API routes
    - Wrap API route error handling with `sanitizeErrorForProduction`
    - Return appropriate HTTP status codes without stack traces in production
    - _Requirements: 15.3_

  - [x] 12.3 Configure route segment caching for dashboard sub-pages
    - Add appropriate `revalidate` export values to dashboard sub-page layouts
    - Classify each sub-page (transactions, budget, cashflow, savings, reports) by data freshness needs
    - _Requirements: 2.4_

- [x] 13. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The implementation language is TypeScript (Next.js 16 + React 19 App Router)
- Existing test framework: Jest (jest.config.js present)
- Package manager: npm
- Deployment target: Vercel

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.4", "2.1", "3.1"] },
    { "id": 1, "tasks": ["1.3", "1.5", "2.2", "2.3", "3.2"] },
    { "id": 2, "tasks": ["2.4", "3.3", "5.1", "6.1", "7.1", "9.1"] },
    { "id": 3, "tasks": ["5.2", "5.3", "6.2", "6.3", "7.2", "7.3", "9.2"] },
    { "id": 4, "tasks": ["7.4", "9.3", "9.4", "10.1", "10.2", "10.3", "11.1", "11.2"] },
    { "id": 5, "tasks": ["12.1", "12.2", "12.3"] }
  ]
}
```
