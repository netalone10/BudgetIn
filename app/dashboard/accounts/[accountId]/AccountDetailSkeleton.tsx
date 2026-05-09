/**
 * Suspense fallback for the account-detail data region.
 * Mirrors the layout of `AccountDetailClient` MINUS the back link & page heading
 * (those are rendered immediately by the server shell as the LCP element).
 */
export default function AccountDetailSkeleton() {
  return (
    <>
      {/* Account Header */}
      <div
        className="rounded-2xl border border-border bg-card p-5 animate-pulse"
        style={{ minHeight: 96 }}
      >
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-xl bg-muted shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-5 w-40 bg-muted rounded" />
            <div className="h-3.5 w-24 bg-muted rounded" />
          </div>
          <div className="text-right shrink-0 space-y-2">
            <div className="h-3 w-20 bg-muted rounded ml-auto" />
            <div className="h-5 w-28 bg-muted rounded ml-auto" />
          </div>
        </div>
      </div>

      {/* Period Filter */}
      <div className="flex flex-wrap gap-2" style={{ minHeight: 32 }}>
        {["month-current", "month-prev", "quarter", "all"].map((key) => (
          <div key={key} className="h-8 w-20 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3" style={{ minHeight: 84 }}>
        {["income", "expense", "net"].map((key) => (
          <div
            key={key}
            className="rounded-xl border border-border bg-card p-4 animate-pulse"
          >
            <div className="h-3 w-12 bg-muted rounded mb-2" />
            <div className="h-5 w-20 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* Transaction List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="h-4 w-40 bg-muted rounded animate-pulse" />
        </div>
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-2.5">
            <div className="h-3 w-full max-w-md bg-muted rounded animate-pulse" />
          </div>
          {["row-1", "row-2", "row-3", "row-4", "row-5"].map((key) => (
            <div
              key={key}
              className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0"
            >
              <div className="h-4 w-12 bg-muted rounded animate-pulse" />
              <div className="h-4 flex-1 bg-muted rounded animate-pulse" />
              <div className="h-4 w-16 bg-muted rounded animate-pulse hidden sm:block" />
              <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
