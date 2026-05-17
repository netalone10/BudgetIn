/**
 * Suspense fallback for the dashboard KPI section.
 * Shows skeleton for KPI cards grid (streams first).
 */
export function KPISectionFallback() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-5">
      {["kpi-1", "kpi-2", "kpi-3", "kpi-4"].map((key) => (
        <div
          key={key}
          className="rounded-[20px] border border-border bg-card p-4 animate-pulse"
          style={{ minHeight: 108 }}
        >
          <div className="h-3.5 w-32 bg-muted rounded mb-2" />
          <div className="h-7 w-48 bg-muted rounded mb-3" />
          <div className="h-3 w-3/4 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

/**
 * Suspense fallback for the secondary dashboard section.
 * Shows skeleton for greeting, input area, transaction history, and budget sidebar.
 * Streams progressively after KPI data is visible.
 */
export function SecondarySectionFallback() {
  return (
    <>
      {/* Greeting */}
      <div className="flex gap-4 mb-5" style={{ minHeight: 96 }}>
        <div className="flex-1 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm animate-pulse">
          <div className="h-4 w-24 bg-muted rounded mb-2" />
          <div className="h-7 w-32 bg-muted rounded" />
        </div>
      </div>

      {/* Prompt Input */}
      <div className="space-y-2 mt-2">
        <div className="relative">
          <div className="h-[72px] rounded-[20px] border border-border bg-card shadow-sm animate-pulse" />
          <div className="absolute bottom-2.5 right-2 size-9 rounded-full bg-muted animate-pulse" />
        </div>
        <div className="h-4 w-56 bg-muted rounded animate-pulse" />
      </div>

      {/* Manual Input */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <div className="h-3 w-20 bg-muted rounded animate-pulse" />
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="h-[280px] rounded-xl border border-border bg-card animate-pulse" />
      </div>

      {/* Tabs */}
      <div className="h-[420px] rounded-xl border border-border bg-card animate-pulse" />

      {/* Transaction History */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <div className="h-3 w-32 bg-muted rounded animate-pulse" />
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="rounded-[24px] border border-border bg-card overflow-hidden shadow-sm">
          {["row-1", "row-2", "row-3", "row-4", "row-5"].map((key) => (
            <div
              key={key}
              className="flex items-center gap-4 px-5 py-4 border-b border-border"
            >
              <div className="h-4 w-12 bg-muted rounded animate-pulse" />
              <div className="h-4 flex-1 bg-muted rounded animate-pulse" />
              <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
              <div className="h-4 w-20 bg-muted rounded animate-pulse" />
              <div className="h-4 w-16 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/**
 * Full suspense fallback for the entire dashboard data region.
 * Used as a combined fallback when streaming is not split into sections.
 * Mirrors the layout of `DashboardClient` MINUS the greeting (which is rendered
 * immediately by the server shell as the LCP element).
 */
export default function DashboardSuspenseFallback() {
  return (
    <>
      <KPISectionFallback />
      <SecondarySectionFallback />
    </>
  );
}
