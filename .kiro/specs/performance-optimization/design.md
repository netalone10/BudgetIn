# Design Document: Performance Optimization

## Architecture Overview

The performance optimization architecture introduces three cross-cutting layers into the existing BudgetIn Next.js 16 application:

1. **Caching Layer** — Server-side request deduplication (React `cache()`), HTTP cache headers, and client-side SWR pattern
2. **Bundle Optimization Layer** — Dynamic imports, tree shaking enforcement, and lazy loading boundaries
3. **Monitoring Layer** — Core Web Vitals reporting, custom timing metrics, Lighthouse CI gates, and threshold alerting

These layers integrate with the existing App Router architecture without changing the fundamental data flow: Server Components fetch via Prisma/Google Sheets → pass data to Client Components → Client Components use SWR for mutations and background revalidation.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js App Router                        │
├─────────────────────────────────────────────────────────────────┤
│  Server Components                                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  React cache() wrapped data fetchers                      │   │
│  │  ┌────────────────┐  ┌──────────────┐  ┌─────────────┐  │   │
│  │  │fetchDashboard  │  │fetchCategories│  │fetchAccounts │  │   │
│  │  │Data()          │  │()            │  │()           │  │   │
│  │  └───────┬────────┘  └──────┬───────┘  └──────┬──────┘  │   │
│  │          │                   │                  │         │   │
│  │          ▼                   ▼                  ▼         │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │  Prisma Client (select-only, parallel queries)      │ │   │
│  │  │  + Google Sheets API (single-call + in-memory cache)│ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  API Routes                                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Cache-Control headers (public/private classification)    │   │
│  │  ETag support + 304 responses                             │   │
│  │  Pagination (default 50, max 200)                         │   │
│  │  Error sanitization (no stack traces in production)       │   │
│  └──────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Client Components                                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  SWR hooks (stale-while-revalidate + optimistic updates)  │   │
│  │  React.lazy() + Suspense (below-fold, modals, dialogs)    │   │
│  │  Dynamic imports (html2canvas, jspdf, groq-sdk)           │   │
│  └──────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Monitoring Layer                                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  @vercel/analytics (CWV: LCP, INP, CLS)                  │   │
│  │  Custom performance marks/measures                         │   │
│  │  Lighthouse CI (PR gates: 80 landing, 70 dashboard)       │   │
│  │  Threshold alerting (24h breach detection)                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Server-Side Cache Layer (`lib/cache.ts`)

Wraps shared data-fetching functions with React `cache()` for per-request deduplication.

```typescript
import { cache } from "react";
import { prisma } from "./prisma";

// Per-request memoization — identical calls within the same
// server render share a single query execution.
export const getCachedDashboardData = cache(
  async (userId: string) => {
    return fetchDashboardData(userId);
  }
);

export const getCachedCategories = cache(
  async (userId: string) => {
    return prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, type: true, isSavings: true, rolloverEnabled: true, budgetType: true },
      orderBy: { name: "asc" },
    });
  }
);

export const getCachedAccounts = cache(
  async (userId: string) => {
    return prisma.account.findMany({
      where: { userId, isActive: true },
      select: { id: true, name: true, currency: true, color: true, icon: true, accountTypeId: true },
    });
  }
);
```

### 2. Cache Header Utility (`lib/cache-headers.ts`)

Classifies API routes and returns appropriate `Cache-Control` headers.

```typescript
export type CacheProfile = "static" | "semi-static" | "private-mutable";

export interface CacheHeaderConfig {
  profile: CacheProfile;
}

const CACHE_HEADERS: Record<CacheProfile, string> = {
  "static": "public, max-age=31536000, immutable",
  "semi-static": "public, s-maxage=60, stale-while-revalidate=300",
  "private-mutable": "private, no-cache",
};

export function getCacheControlHeader(config: CacheHeaderConfig): string {
  return CACHE_HEADERS[config.profile];
}

// Route classification map
export const ROUTE_CACHE_PROFILES: Record<string, CacheProfile> = {
  "/api/categories": "semi-static",
  "/api/account-types": "semi-static",
  "/api/transactions": "private-mutable",
  "/api/budget": "private-mutable",
  "/api/savings": "private-mutable",
  "/api/accounts": "private-mutable",
  "/api/cashflow": "private-mutable",
  "/api/recurring": "private-mutable",
};
```

### 3. Client-Side SWR Hook (`lib/hooks/use-api.ts`)

Provides stale-while-revalidate fetching with optimistic updates and request deduplication.

```typescript
import useSWR, { mutate } from "swr";

interface UseApiOptions<T> {
  fallbackData?: T;
  revalidateOnFocus?: boolean;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
};

export function useApi<T>(endpoint: string, options?: UseApiOptions<T>) {
  return useSWR<T>(endpoint, fetcher, {
    fallbackData: options?.fallbackData,
    revalidateOnFocus: options?.revalidateOnFocus ?? false,
    dedupingInterval: 2000,
    errorRetryCount: 3,
    errorRetryInterval: 1000, // exponential backoff handled by SWR
  });
}

export interface OptimisticMutationOptions<T, M> {
  endpoint: string;
  mutationType: "create" | "update" | "delete";
  mutationData: M;
  currentData: T[];
  optimisticTransform: (current: T[], mutation: M) => T[];
  rollbackData: T[];
}

export function applyOptimisticUpdate<T, M>(
  options: OptimisticMutationOptions<T, M>
): T[] {
  return options.optimisticTransform(options.currentData, options.mutationData);
}
```

### 4. Pagination Utility (`lib/pagination.ts`)

Enforces pagination limits across API routes and dashboard queries.

```typescript
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export function normalizePaginationParams(params: PaginationParams): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function paginateArray<T>(
  items: T[],
  params: PaginationParams
): PaginatedResult<T> {
  const { page, limit, skip } = normalizePaginationParams(params);
  const total = items.length;
  const totalPages = Math.ceil(total / limit);
  const data = items.slice(skip, skip + limit);

  return { data, pagination: { page, limit, total, totalPages } };
}
```

### 5. API Error Handler (`lib/api-error.ts`)

Sanitizes error responses for production, mapping errors to appropriate HTTP status codes.

```typescript
export interface ApiErrorResponse {
  error: string;
  code: string;
  statusCode: number;
}

export type ErrorType = "validation" | "unauthorized" | "forbidden" | "not_found" | "internal";

const STATUS_MAP: Record<ErrorType, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  internal: 500,
};

const MESSAGE_MAP: Record<ErrorType, string> = {
  validation: "Invalid request parameters",
  unauthorized: "Authentication required",
  forbidden: "Access denied",
  not_found: "Resource not found",
  internal: "Internal server error",
};

export function createApiError(
  type: ErrorType,
  customMessage?: string
): ApiErrorResponse {
  return {
    error: customMessage ?? MESSAGE_MAP[type],
    code: type.toUpperCase(),
    statusCode: STATUS_MAP[type],
  };
}

export function sanitizeErrorForProduction(
  error: unknown,
  type: ErrorType = "internal"
): ApiErrorResponse {
  // Never expose stack traces or internal details in production
  if (process.env.NODE_ENV === "production") {
    return createApiError(type);
  }
  // In development, include the error message (but never the stack)
  const message = error instanceof Error ? error.message : String(error);
  return createApiError(type, message);
}
```

### 6. ETag Utility (`lib/etag.ts`)

Generates ETags for API responses and handles conditional requests.

```typescript
import { createHash } from "crypto";

export function generateETag(data: unknown): string {
  const hash = createHash("md5")
    .update(JSON.stringify(data))
    .digest("hex");
  return `"${hash}"`;
}

export function shouldReturn304(
  requestETag: string | null,
  currentETag: string
): boolean {
  if (!requestETag) return false;
  // Handle both strong and weak ETags
  const normalized = requestETag.replace(/^W\//, "");
  return normalized === currentETag;
}
```

### 7. Google Sheets Fallback Handler (`lib/sheets-fallback.ts`)

Manages graceful degradation when Google Sheets API calls fail.

```typescript
export interface SheetsFallbackResult<T> {
  data: T;
  isStale: boolean;
  error: string | null;
}

// In-memory cache for last successful Sheets response per user
const sheetsCache = new Map<string, { data: unknown; timestamp: number }>();
const STALE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function handleSheetsFallback<T>(
  userId: string,
  error: unknown,
  emptyDataFactory: () => T
): SheetsFallbackResult<T> {
  const cached = sheetsCache.get(userId);

  if (cached && Date.now() - cached.timestamp < STALE_TTL_MS) {
    return {
      data: cached.data as T,
      isStale: true,
      error: error instanceof Error ? error.message : "Google Sheets API error",
    };
  }

  return {
    data: emptyDataFactory(),
    isStale: false,
    error: error instanceof Error ? error.message : "Google Sheets API error",
  };
}

export function cacheSheetResponse(userId: string, data: unknown): void {
  sheetsCache.set(userId, { data, timestamp: Date.now() });
}
```

### 8. Performance Monitoring (`lib/performance.ts`)

Custom timing metrics and threshold alerting.

```typescript
export interface PerformanceThreshold {
  metricName: string;
  thresholdMs: number;
}

export interface ThresholdBreachWarning {
  metricName: string;
  measuredMs: number;
  thresholdMs: number;
  message: string;
}

const THRESHOLDS: Record<string, number> = {
  "dashboard-tti": 3000,
  "transaction-create": 2000,
  "pdf-generation": 10000,
  "sheets-sync": 5000,
};

export function checkThresholdBreach(
  metricName: string,
  measuredMs: number
): ThresholdBreachWarning | null {
  const threshold = THRESHOLDS[metricName];
  if (!threshold || measuredMs <= threshold) return null;

  return {
    metricName,
    measuredMs,
    thresholdMs: threshold,
    message: `Performance warning: ${metricName} took ${measuredMs}ms (threshold: ${threshold}ms)`,
  };
}

// Client-side performance measurement
export function measureTiming(markName: string): () => number {
  if (typeof performance === "undefined") return () => 0;
  performance.mark(`${markName}-start`);
  return () => {
    performance.mark(`${markName}-end`);
    const measure = performance.measure(markName, `${markName}-start`, `${markName}-end`);
    return measure.duration;
  };
}
```

### 9. Query Builder (`lib/query-builder.ts`)

Constructs optimized Prisma queries with proper filters and field selection for dashboard data.

```typescript
export interface TransactionQueryParams {
  userId: string;
  month: string; // YYYY-MM format
  accountId?: string;
  type?: string;
}

export interface TransactionQueryConfig {
  where: Record<string, unknown>;
  select: Record<string, boolean>;
  orderBy: Record<string, string>;
  take: number;
}

const TRANSACTION_SELECT_FIELDS = {
  id: true,
  date: true,
  time: true,
  amount: true,
  category: true,
  note: true,
  type: true,
  accountId: true,
  transferId: true,
  isInitialBalance: true,
} as const;

export function buildTransactionQuery(
  params: TransactionQueryParams
): TransactionQueryConfig {
  const [year, monthNum] = params.month.split("-").map(Number);
  const startDate = `${params.month}-01`;
  // Calculate last day of month
  const lastDay = new Date(year, monthNum, 0).getDate();
  const endDate = `${params.month}-${String(lastDay).padStart(2, "0")}`;

  const where: Record<string, unknown> = {
    userId: params.userId,
    date: { gte: startDate, lte: endDate },
  };

  if (params.accountId) where.accountId = params.accountId;
  if (params.type) where.type = params.type;

  return {
    where,
    select: { ...TRANSACTION_SELECT_FIELDS },
    orderBy: { date: "desc" },
    take: 200, // Max records per page load
  };
}
```

### 10. Dynamic Import Wrappers (`lib/dynamic-imports.ts`)

Lazy-loaded heavy dependency wrappers triggered only on user action.

```typescript
// PDF Generation — loaded only when user clicks "Generate Report"
export async function generatePDF(element: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(element);
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");
  const width = pdf.internal.pageSize.getWidth();
  const height = (canvas.height * width) / canvas.width;
  pdf.addImage(imgData, "PNG", 0, 0, width, height);
  pdf.save(filename);
}

// AI Analysis — loaded only when user triggers analysis
export async function analyzeWithAI(prompt: string, apiKey: string) {
  const { default: Groq } = await import("groq-sdk");
  const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });
  return groq.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "llama-3.3-70b-versatile",
  });
}
```

### 11. Lighthouse CI Configuration (`lighthouserc.js`)

```typescript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: ["http://localhost:3000/", "http://localhost:3000/dashboard"],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        "categories:performance": [
          "error",
          { minScore: 0.7, aggregationMethod: "median-run" },
        ],
      },
      preset: "lighthouse:no-pwa",
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
```

## Data Models

### Cache Configuration

```typescript
interface CacheConfig {
  profile: "static" | "semi-static" | "private-mutable";
  revalidateSeconds?: number;
  staleWhileRevalidateSeconds?: number;
}
```

### Pagination

```typescript
interface PaginationParams {
  page?: number;   // 1-indexed, default 1
  limit?: number;  // default 50, max 200
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### Performance Metrics

```typescript
interface PerformanceMetric {
  name: string;
  value: number;
  threshold: number;
  timestamp: number;
}

interface ThresholdBreachEvent {
  metricName: string;
  measuredMs: number;
  thresholdMs: number;
  consecutiveBreachHours: number;
}
```

### Optimistic Mutation

```typescript
interface OptimisticMutation<T> {
  type: "create" | "update" | "delete";
  data: Partial<T>;
  rollback: T[];
  endpoint: string;
}
```

## Interfaces

### Cache Layer Interface

```typescript
// lib/cache.ts
export function getCachedDashboardData(userId: string): Promise<DashboardInitialData>;
export function getCachedCategories(userId: string): Promise<Category[]>;
export function getCachedAccounts(userId: string): Promise<Account[]>;
```

### API Response Helpers

```typescript
// lib/api-helpers.ts
export function withCacheHeaders(
  response: NextResponse,
  profile: CacheProfile
): NextResponse;

export function withETag(
  response: NextResponse,
  data: unknown
): NextResponse;

export function handleConditionalRequest(
  request: NextRequest,
  data: unknown
): NextResponse | null; // returns 304 response or null to continue
```

### SWR Hooks Interface

```typescript
// lib/hooks/use-api.ts
export function useApi<T>(endpoint: string, options?: UseApiOptions<T>): SWRResponse<T>;
export function useOptimisticMutation<T>(endpoint: string): {
  trigger: (data: Partial<T>, type: "create" | "update" | "delete") => Promise<T>;
  isMutating: boolean;
};
```

### Performance Monitoring Interface

```typescript
// lib/performance.ts
export function measureTiming(markName: string): () => number;
export function checkThresholdBreach(metricName: string, measuredMs: number): ThresholdBreachWarning | null;
export function reportWebVitals(metric: { name: string; value: number }): void;
```

## Error Handling

### API Error Strategy

All API routes use a consistent error handling pattern:

1. **Validation errors (400)** — Invalid pagination params, malformed request body
2. **Authentication errors (401)** — Missing or expired session
3. **Not found errors (404)** — Resource doesn't exist or belongs to another user
4. **Internal errors (500)** — Unexpected failures, logged server-side

Production responses never include stack traces or internal implementation details.

### Google Sheets Fallback Strategy

```
API Call → Success → Cache response + return fresh data
         → Failure → Check stale cache
                     → Cache hit (< 5min) → Return stale data + error indicator
                     → Cache miss → Return empty dataset + error indicator
```

### SWR Retry Strategy

```
Fetch failure → Retry 1 (1s delay)
             → Retry 2 (2s delay)
             → Retry 3 (4s delay)
             → Show error state + offer manual retry
```

### Connection Pool Exhaustion

Prisma's built-in connection pool handles queuing. The `connection_limit` parameter in `DATABASE_URL` is set to match Vercel's serverless concurrency (typically 5-10 connections per instance). Prisma will queue requests and timeout after 10 seconds if no connection becomes available.

## Next.js Configuration Changes

```typescript
// next.config.ts additions
experimental: {
  optimizePackageImports: [
    "lucide-react",
    "date-fns",
    "date-fns-tz",
    "framer-motion", // Added
  ],
},
```

## Database Index Strategy

The existing Prisma schema already has the required indexes:
- Transaction: `@@index([userId, date])`, `@@index([userId, accountId, date])`, `@@index([userId, type, date])`
- SavingsContribution: `@@index([userId, goalId])`, `@@index([userId, date])`

Missing index to add:
- Budget: composite index on `(userId, month)` — currently only has `@@unique([userId, categoryId, month])`

```prisma
model Budget {
  // ... existing fields
  @@unique([userId, categoryId, month])
  @@index([userId, month])  // NEW: covers dashboard budget queries
  @@map("budgets")
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Cache Header Classification Correctness

*For any* API route configuration with a defined cache profile, the `getCacheControlHeader` function SHALL return the exact Cache-Control header string corresponding to that profile: "public, max-age=31536000, immutable" for static, "public, s-maxage=60, stale-while-revalidate=300" for semi-static, and "private, no-cache" for private-mutable.

**Validates: Requirements 2.2, 2.3**

### Property 2: Optimistic Cache Mutation Consistency

*For any* valid transaction data and mutation type (create, update, or delete), the `applyOptimisticUpdate` function SHALL produce a new cache state that reflects the mutation: create increases array length by 1 and includes the new item, update preserves array length and modifies the target item, delete decreases array length by 1 and excludes the removed item.

**Validates: Requirements 3.2**

### Property 3: Transaction Query Builder Date Range Correctness

*For any* valid month string in YYYY-MM format, the `buildTransactionQuery` function SHALL produce a query with a `date` filter whose `gte` value is the first day of that month and whose `lte` value is the last day of that month, and SHALL include only the fields defined in `TRANSACTION_SELECT_FIELDS`.

**Validates: Requirements 6.1**

### Property 4: Pagination Limit Enforcement

*For any* pagination parameters (page ≥ 1, limit ≥ 1), the `normalizePaginationParams` function SHALL return a limit that is at most `MAX_LIMIT` (200). *For any* input array of arbitrary length and any pagination parameters, `paginateArray` SHALL return a `data` array whose length is at most the normalized limit, and the default limit SHALL be 50 when no limit parameter is provided.

**Validates: Requirements 6.4, 15.2**

### Property 5: Google Sheets API Fallback Graceful Degradation

*For any* API error and user ID, the `handleSheetsFallback` function SHALL return either cached stale data (when a cache entry exists within the TTL) with `isStale: true`, or the result of `emptyDataFactory()` with `isStale: false`, and SHALL always include a non-null `error` string describing the failure.

**Validates: Requirements 8.4**

### Property 6: Performance Threshold Breach Detection

*For any* metric name with a defined threshold and any measured duration, `checkThresholdBreach` SHALL return `null` when the measured duration is less than or equal to the threshold, and SHALL return a `ThresholdBreachWarning` containing the metric name, measured duration, and threshold value when the measured duration exceeds the threshold.

**Validates: Requirements 11.5, 12.5**

### Property 7: API Error Response Sanitization

*For any* error type (validation, unauthorized, forbidden, not_found, internal), the `sanitizeErrorForProduction` function in production mode SHALL return an `ApiErrorResponse` with the correct HTTP status code (400, 401, 403, 404, 500 respectively) and SHALL never include the original error message or stack trace in the response.

**Validates: Requirements 15.3**

### Property 8: ETag Conditional Response

*For any* data payload, `generateETag` SHALL produce a deterministic string. *For any* request ETag that exactly matches the current ETag (with or without weak validator prefix), `shouldReturn304` SHALL return `true`. *For any* request ETag that does not match or is null, `shouldReturn304` SHALL return `false`.

**Validates: Requirements 15.4**
