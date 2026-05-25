export default function CashflowLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 md:p-8 space-y-6">
      <div className="space-y-1 mt-4 md:mt-2">
        <div className="h-8 w-32 bg-muted rounded-lg animate-pulse" />
        <div className="h-4 w-52 bg-muted rounded animate-pulse" />
      </div>

      {/* Period selector */}
      <div className="flex gap-2">
        <div className="h-9 w-8 bg-muted rounded-lg animate-pulse" />
        <div className="h-9 w-32 bg-muted rounded-lg animate-pulse" />
        <div className="h-9 w-8 bg-muted rounded-lg animate-pulse" />
      </div>

      {/* Net cashflow bar */}
      <div className="rounded-xl border border-border bg-card p-4 animate-pulse flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-3 w-24 bg-muted rounded" />
          <div className="h-7 w-32 bg-muted rounded" />
        </div>
        <div className="h-5 w-20 bg-muted rounded-full" />
      </div>

      {/* In/Out cards */}
      <div className="grid grid-cols-2 gap-3">
        {["in", "out"].map((k) => (
          <div key={k} className="rounded-xl border border-border bg-card p-4 animate-pulse space-y-2">
            <div className="h-3 w-16 bg-muted rounded" />
            <div className="h-6 w-28 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-border bg-card p-5 animate-pulse">
        <div className="h-4 w-36 bg-muted rounded mb-4" />
        <div className="h-48 w-full bg-muted rounded-xl" />
      </div>

      {/* Category rows */}
      <div className="space-y-2">
        {["c1", "c2", "c3", "c4", "c5"].map((k) => (
          <div key={k} className="rounded-xl border border-border bg-card px-4 py-3 animate-pulse flex items-center gap-3">
            <div className="size-8 bg-muted rounded-lg" />
            <div className="flex-1 space-y-1">
              <div className="h-3 w-28 bg-muted rounded" />
              <div className="h-2 bg-muted rounded-full w-3/4" />
            </div>
            <div className="h-4 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
