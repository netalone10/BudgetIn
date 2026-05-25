export default function ReportLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 md:p-8 space-y-6">
      <div className="space-y-1 mt-4 md:mt-2">
        <div className="h-8 w-28 bg-muted rounded-lg animate-pulse" />
        <div className="h-4 w-48 bg-muted rounded animate-pulse" />
      </div>

      {/* Report type tabs */}
      <div className="flex gap-2 border-b border-border pb-1">
        {["a", "b", "c"].map((k) => (
          <div key={k} className="h-9 w-28 bg-muted rounded-t-lg animate-pulse" />
        ))}
      </div>

      {/* Period selector */}
      <div className="flex gap-2">
        <div className="h-9 w-8 bg-muted rounded-lg animate-pulse" />
        <div className="h-9 w-32 bg-muted rounded-lg animate-pulse" />
        <div className="h-9 w-8 bg-muted rounded-lg animate-pulse" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {["a", "b", "c"].map((k) => (
          <div key={k} className="rounded-xl border border-border bg-card p-4 animate-pulse space-y-2">
            <div className="h-3 w-16 bg-muted rounded" />
            <div className="h-6 w-24 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-border bg-card p-5 animate-pulse">
        <div className="h-4 w-36 bg-muted rounded mb-4" />
        <div className="h-52 w-full bg-muted rounded-xl" />
      </div>

      {/* Category breakdown */}
      <div className="rounded-2xl border border-border bg-card p-5 animate-pulse space-y-3">
        <div className="h-4 w-32 bg-muted rounded" />
        {["c1", "c2", "c3", "c4"].map((k) => (
          <div key={k} className="flex items-center gap-3">
            <div className="size-8 bg-muted rounded-lg shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="h-3 w-32 bg-muted rounded" />
              <div className="h-2 w-full bg-muted rounded-full" />
            </div>
            <div className="h-4 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
