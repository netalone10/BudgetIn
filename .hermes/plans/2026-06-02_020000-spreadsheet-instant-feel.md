# BudgetIn: Spreadsheet-Instant Performance Plan

**Goal:** Make BudgetIn dashboard feel as instant as Google Sheets — zero visible loading, optimistic updates, persistent cache.

**Current state:** Shell renders instantly (client-side fetch), but data still takes 200-500ms. No offline cache. CRUD operations wait for server response before updating UI.

**Reference:** Google Sheets renders on `<canvas>`, keeps all data in memory, syncs in background. We achieve 90% of that feel with SWR cache + optimistic updates + virtual scrolling.

---

## Before/After Overview

| Kondisi | BEFORE | AFTER |
|---------|--------|-------|
| First visit | Shell → blank 200-500ms → data | Shell → data (200ms) |
| Repeat visit | Shell → blank 200-500ms → data | Shell → data (instant dari cache) |
| Add transaksi | Loading spinner → muncul | Langsung muncul, sync di background |
| Refresh page | Flash kosong → data | Instant, no flash |
| Scroll 200 transaksi | Jank, frame drop | 60fps smooth |
| Offline | Gak bisa akses | Cached data available |
| Total JS bundle | ~350KB | ~310KB |

---

## Phase 1: LocalStorage Cache Provider (instant repeat visits)

**Effort:** 1-2 hours | **Risk:** 🟢 | **Impact:** 🔴🔴🔴🔴🔴

**What:** Persist SWR cache to localStorage. On page load, data appears instantly from cache before any API call.

### Before:
- Klik /dashboard → shell muncul → **kosong 200-500ms** → data populate
- Refresh page → **flash kosong lagi** → nunggu API
- Buka tab baru → **blank screen sebentar** → data load

### After:
- Klik /dashboard → shell muncul → **data langsung ada dari cache** → background refresh
- Refresh page → **instant, gak ada flash kosong**
- Buka tab baru → **data udah tampil sebelum API respond**

### Files to create/modify:
- `lib/cache-provider.ts` (NEW) — localStorage-backed SWR cache provider
- `components/Providers.tsx` — wrap SessionProvider with SWRConfig

### Implementation:
```ts
// lib/cache-provider.ts
function localStorageProvider() {
  if (typeof window === 'undefined') return new Map();
  const map = new Map(JSON.parse(localStorage.getItem('budgetin-cache') || '[]'));
  // Persist on beforeunload (debounced)
  window.addEventListener('beforeunload', () => {
    localStorage.setItem('budgetin-cache', JSON.stringify(Array.from(map.entries())));
  });
  return map;
}
```

```tsx
// components/Providers.tsx
import { SWRConfig } from 'swr';
import { localStorageProvider } from '@/lib/cache-provider';

export default function Providers({ children }) {
  return (
    <SessionProvider>
      <SWRConfig value={{ provider: localStorageProvider, revalidateOnFocus: true }}>
        {children}
      </SWRConfig>
    </SessionProvider>
  );
}
```

### Verification:
- First visit: data loads from API, cached to localStorage
- Second visit: data appears instantly from cache, refreshes in background
- Logout: localStorage cleared
- Check: `localStorage.getItem('budgetin-cache')` has data after first load

---

## Phase 2: Optimistic UI Updates (instant CRUD)

**Effort:** 2-3 hours | **Risk:** 🟢 | **Impact:** 🔴🔴🔴🔴🔴

**What:** All transaction CRUD operations update UI instantly before server confirms. Rollback on error.

### Before:
- Ketik "ngopi 42rb" → enter → **loading spinner** → 500ms-2s → transaksi muncul
- Hapus transaksi → **confirmation dialog** → loading → hilang
- Edit nominal → **form modal** → save → loading → update

### After:
- Ketik "ngopi 42rb" → enter → **transaksi langsung muncul** → background sync
- Hapus transaksi → **langsung hilang dari list** → server sync di belakang
- Edit nominal → **perubahan langsung keliatan** → server sync di belakang
- Kalo server gagal → **rollback otomatis** + toast error

### Error Handling Strategy

**Scenario 1: Server return error (4xx/5xx)**
```
User ketik "ngopi 42rb"
→ Transaksi muncul langsung (optimistic)
→ POST /api/record gagal (misal: token expired)
→ Rollback: transaksi hilang dari list
→ Toast error: "Gagal menyimpan — sesi Google expired"
→ User tetap bisa retry
```

**Scenario 2: Network timeout**
```
User ketik "ngopi 42rb"
→ Transaksi muncul langsung
→ Fetch timeout (10 detik)
→ Rollback: transaksi hilang
→ Toast: "Koneksi lambat, coba lagi"
→ Data tetap ada di localStorage (Phase 1)
```

**Scenario 3: Network offline total**
```
User ketik "ngopi 42rb"
→ Transaksi muncul langsung
→ Fetch langsung gagal (gak ada koneksi)
→ Rollback: transaksi hilang
→ Toast: "Offline — transaksi tidak tersimpan"
→ Service Worker (Phase 6) bisa queue request
```

**Scenario 4: Server OK tapi data salah**
```
User ketik "ngopi 42rb"
→ Transaksi muncul: Rp42.000, Kopi & Jajan ✓
→ Server return response benar
→ Replace temp dengan data real dari server
→ User gak ngerasa ada bedanya
```

**Scenario 5: Race condition (2 transaksi cepet)**
```
User ketik "ngopi 42rb" → muncul (temp-1)
User langsung ketik "bensin 50rb" → muncul (temp-2)
→ Response pertama datang → temp-1 replaced
→ Response kedua datang → temp-2 replaced
→ Kedua transaksi benar, urutan benar
```

### Safety Nets:

| Safety net | Fungsi |
|------------|--------|
| `tempId` unique | Gak ada collision antar optimistic updates |
| `rollback on error` | Transaksi palsu gak pernah persist |
| `toast error` | User tau ada masalah, bisa retry |
| `emitDataChanged` | Budget/counter tetap update setelah sync |
| `finally { setInputLoading }` | Loading state selalu reset |

### Rules:
- **Jangan persist optimistic data ke localStorage** — kalo server gagal, data palsu tetap ada di cache
- **Jangan auto-retry tanpa batas** — user harus tau ada error
- **Jangan rollback SEMUA transaksi** — cuma rollback yang gagal, yang lain tetap ada

### Files to modify:
- `app/dashboard/DashboardClient.tsx` — replace manual state updates with SWR `mutate` optimistic pattern
- `components/ManualTransactionForm.tsx` — optimistic add
- `components/TransactionCard.tsx` — optimistic edit/delete
- `app/api/record/route.ts` — return created transaction data for cache update

### Implementation pattern:
```ts
const handleSubmit = async (text: string) => {
  const tempId = `temp-${Date.now()}`;
  const tempTx = {
    id: tempId,
    date: todayStr,
    amount: 0,
    category: 'Processing...',
    note: text,
    type: 'expense',
    created_at: new Date().toISOString(),
  };

  // 1. Optimistic: langsung tampil
  setTransactions(prev => [tempTx, ...prev]);
  setInputLoading(true);

  try {
    const res = await fetch('/api/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const data = await res.json();

    // 2. Server OK: replace temp dengan data real
    if (data.transaction) {
      setTransactions(prev =>
        prev.map(tx => tx.id === tempId ? data.transaction : tx)
      );
    } else if (data.transactions) {
      // Bulk: multiple transactions parsed
      setTransactions(prev => {
        const withoutTemp = prev.filter(tx => tx.id !== tempId);
        return [...data.transactions, ...withoutTemp];
      });
    }

    // 3. Invalidate budget cache
    emitDataChanged('budget');
    emitDataChanged('transactions');

  } catch (error) {
    // 4. Rollback: hapus temp transaction
    setTransactions(prev => prev.filter(tx => tx.id !== tempId));

    // 5. User-friendly error
    if (error instanceof TypeError && error.message.includes('fetch')) {
      toast.error('Koneksi terputus — coba lagi');
    } else {
      toast.error('Gagal menyimpan transaksi');
    }
  } finally {
    setInputLoading(false);
  }
};
```

### Verification:
- Add transaction → appears instantly in list
- Add transaction with network offline → rolls back, shows error
- Edit transaction → changes appear immediately
- Delete transaction → removed instantly, reappears if server fails
- Rapid fire 5 transactions → all appear, all sync correctly

---

## Phase 3: Bundle Size Optimization (faster initial load)

**Effort:** 1-2 hours | **Risk:** 🟢 | **Impact:** 🔴🔴🔴🔴

**What:** Remove dead deps, dynamic-import heavy Sidebar components, replace framer-motion with CSS transitions.

### Before:
- First load: **~350KB JS** (framer-motion 30KB + dead @tanstack/react-virtual 10KB + 4 Sidebar modals)
- Sidebar buka: **semua modal di-load sekaligus** walau gak dipake
- NetWorthSummaryCard: **fetch /api/accounts 2x** (parent + sendiri)
- `date-fns-tz`: **~5KB** buat konversi timezone doang

### After:
- First load: **~310KB JS** (hemat ~40KB)
- Sidebar buka: **modal load on-demand** pas user klik
- NetWorthSummaryCard: **fetch 1x aja** (data dari parent)
- Timezone: **native Intl** (0KB额外)

### Files to modify:
- `package.json` — remove `@tanstack/react-virtual` (dead dep)
- `components/Sidebar.tsx` — dynamic-import 4 modals, replace framer-motion with CSS transitions
- `lib/date-utils.ts` (NEW) — replace `date-fns-tz` with native `Intl.DateTimeFormat`
- `components/NetWorthSummaryCard.tsx` — deduplicate `/api/accounts` fetch (accept as prop)

### Changes:
1. **Remove `@tanstack/react-virtual`** — 0 imports, dead dependency
2. **Sidebar modals → `dynamic()`** — `ManageCategoriesModal`, `ChangePasswordModal`, `OnboardingModal`, `CalculatorModal` lazy-loaded only when opened
3. **Replace framer-motion in Sidebar** — sidebar width/opacity transitions via CSS `transition: width 0.2s, opacity 0.2s`. Saves ~30KB from initial bundle.
4. **Deduplicate `/api/accounts`** — NetWorthSummaryCard currently fetches independently. Accept `accounts` as prop from DashboardClient instead.
5. **Replace `date-fns-tz`** — `toZonedTime(new Date(), 'Asia/Jakarta')` can be `new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })` or native Intl.

### Verification:
- `next build` — check bundle sizes decrease
- Sidebar opens/closes smoothly without framer-motion
- NetWorthSummaryCard shows correct data (from parent prop, not independent fetch)
- All date/time displays correct in Asia/Jakarta timezone

---

## Phase 4: Re-Render Optimization (smooth interactions)

**Effort:** 1-2 hours | **Risk:** 🟡 | **Impact:** 🔴🔴🔴

**What:** Reduce unnecessary re-renders in DashboardClient. Memoize expensive computations, stabilize callbacks.

### Before:
- Ketik di prompt input → **seluruh dashboard re-render** (15+ useState)
- Transaction list re-render **setiap state change**
- `new Date()` dihitung **setiap render** (bukan setiap menit)
- Budget cards re-render **walau data gak berubah**

### After:
- Ketik di prompt input → **cuma input yang re-render**
- Transaction list **cuma re-render kalo data berubah**
- `new Date()` dihitung **setiap menit** (useRef + interval)
- Budget cards **gak re-render** kalo data sama (React.memo)

### Files to modify:
- `app/dashboard/DashboardClient.tsx` — memoize date/time, stabilize callbacks with useCallback
- `components/dashboard/RecentTransactionsCard.tsx` — wrap with React.memo
- `components/dashboard/BudgetMiniListCard.tsx` — wrap with React.memo

### Changes:
1. **Memoize date computation** — `new Date()` runs every render. Move to `useRef` + interval (update every minute, not every render).
2. **Stabilize `handleManualTransactionCreated`** — currently depends on `[accounts, transactions]`, recreated every render. Use `useCallback` with stable deps.
3. **Wrap list items with `React.memo`** — RecentTransactionsCard, BudgetMiniListCard don't need to re-render when unrelated state changes.
4. **Debounce prompt examples shuffle** — `randomizePromptExamples` creates new array + calls setState on every render.

### Verification:
- Add React DevTools Profiler → confirm fewer re-renders on state changes
- Transaction list doesn't re-render when typing in prompt input
- Budget cards don't re-render when transactions update

---

## Phase 5: Virtual Scrolling (large transaction lists)

**Effort:** 3-4 hours | **Risk:** 🟡 | **Impact:** 🔴🔴🔴🔴

**What:** Virtualize transaction list for users with 100+ transactions per month.

### Before:
- 200 transaksi → **200 DOM nodes** di-render
- Scroll list → **jank, frame drop** (DOM manipulation berat)
- Memory: **~5MB** buat 200 rows

### After:
- 200 transaksi → **cuma ~15 DOM nodes** (visible rows aja)
- Scroll list → **60fps smooth** (virtual transform)
- Memory: **~0.5MB** (10x reduction)

### Files to modify:
- `components/dashboard/RecentTransactionsCard.tsx` — implement virtual scrolling
- `package.json` — re-add `@tanstack/react-virtual` (now actually used)

### Implementation:
```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function TransactionList({ transactions }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 5,
  });
  // Render only visible rows
}
```

### Verification:
- 100+ transactions → smooth scrolling, no jank
- Scroll performance: 60fps (check with Chrome DevTools Performance tab)
- Memory usage: stable (not growing with transaction count)

---

## Phase 6: Service Worker (PWA + offline cache)

**Effort:** 4-6 hours | **Risk:** 🟡 | **Impact:** 🔴🔴🔴

**What:** Service worker caches static assets + API responses. App works offline with cached data.

### Before:
- Buka app → **download JS/CSS dari server** (200-500ms)
- Offline → **app gak bisa diakses sama sekali**
- Repeat visit → **tetep download ulang** assets

### After:
- Buka app → **load dari cache** (<50ms) → update di background
- Offline → **app masih jalan** dengan cached data
- Repeat visit → **instant load** dari service worker cache

### Files to create/modify:
- `public/sw.js` (NEW) — service worker with StaleWhileRevalidate strategy
- `app/layout.tsx` — register service worker
- `next.config.ts` — configure caching headers

### Strategy:
- Static assets (JS, CSS, images) → CacheFirst (serve from cache, update in background)
- API responses → NetworkFirst with cache fallback (try network, fall back to cache)
- HTML pages → StaleWhileRevalidate (serve cached, update in background)

### Verification:
- DevTools → Application → Service Workers → active
- DevTools → Application → Cache Storage → has cached assets
- Offline mode: app still loads with cached data
- First visit: network fetch, cached for next time
- Second visit: instant load from service worker cache

---

## Execution Order

| Phase | Effort | Impact | Dependencies |
|-------|--------|--------|-------------|
| 1. LocalStorage cache | 1-2h | 🔴🔴🔴🔴🔴 | None |
| 2. Optimistic UI | 2-3h | 🔴🔴🔴🔴🔴 | Phase 1 |
| 3. Bundle optimization | 1-2h | 🔴🔴🔴🔴 | None |
| 4. Re-render optimization | 1-2h | 🔴🔴🔴 | None |
| 5. Virtual scrolling | 3-4h | 🔴🔴🔴🔴 | None |
| 6. Service Worker | 4-6h | 🔴🔴🔴 | Phase 1 |

**Total: 12-19 hours for spreadsheet-like instant feel**

**Recommended: Start with Phase 1 + 2 + 3 (4-7 hours)** — covers 80% of the feel improvement.

---

## Risks & Tradeoffs

| Risk | Mitigation |
|------|------------|
| localStorage quota (5MB) | Store only essential data (transactions, budgets). Don't store user sessions. |
| Stale data from cache | SWR `revalidateOnFocus: true` ensures fresh data on tab switch |
| Optimistic update rollback confusion | Show subtle "retry" indicator, not jarring error popup |
| Optimistic data in localStorage | NEVER persist optimistic data to localStorage — only persist after server confirms |
| Service worker caching old versions | Use `revision` in precache manifest, update on deploy |
| framer-motion removal breaks Sidebar | Test all sidebar interactions: open, close, mobile toggle, theme switch |

---

## Open Questions

1. **Transaction list size:** How many transactions does the average user have per month? If <50, Phase 5 (virtual scrolling) can be skipped.
2. **Offline priority:** Is offline support (Phase 6) important for users, or is it nice-to-have?
3. **Inline editing:** Does the user want to edit transactions inline (click to edit amount/category) or is the current modal/form flow acceptable?
