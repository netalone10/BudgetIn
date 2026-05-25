export default function AnalystLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 md:p-8 space-y-6">
      <div className="space-y-1 mt-4 md:mt-2">
        <div className="h-8 w-32 bg-muted rounded-lg animate-pulse" />
        <div className="h-4 w-56 bg-muted rounded animate-pulse" />
      </div>

      {/* Period selector */}
      <div className="flex gap-2 flex-wrap">
        {["a", "b", "c", "d"].map((k) => (
          <div key={k} className="h-8 w-20 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {["k1", "k2", "k3", "k4"].map((k) => (
          <div key={k} className="rounded-xl border border-border bg-card p-4 animate-pulse space-y-2">
            <div className="h-3 w-16 bg-muted rounded" />
            <div className="h-6 w-24 bg-muted rounded" />
            <div className="h-3 w-12 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="rounded-2xl border border-border bg-card p-5 animate-pulse">
        <div className="h-4 w-40 bg-muted rounded mb-4" />
        <div className="h-48 w-full bg-muted rounded-xl" />
      </div>

      {/* Second chart */}
      <div className="rounded-2xl border border-border bg-card p-5 animate-pulse">
        <div className="h-4 w-36 bg-muted rounded mb-4" />
        <div className="h-40 w-full bg-muted rounded-xl" />
      </div>
    </div>
  );
}
