export default function BudgetLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between mt-4 md:mt-2">
        <div className="space-y-1">
          <div className="h-8 w-24 bg-muted rounded-lg animate-pulse" />
          <div className="h-4 w-48 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-9 w-28 bg-muted rounded-lg animate-pulse" />
      </div>

      {/* Month selector */}
      <div className="flex gap-2">
        <div className="h-9 w-8 bg-muted rounded-lg animate-pulse" />
        <div className="h-9 w-32 bg-muted rounded-lg animate-pulse" />
        <div className="h-9 w-8 bg-muted rounded-lg animate-pulse" />
      </div>

      {/* Summary bar */}
      <div className="rounded-xl border border-border bg-card p-4 animate-pulse space-y-3">
        <div className="flex justify-between">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-4 w-24 bg-muted rounded" />
        </div>
        <div className="h-2.5 w-full bg-muted rounded-full" />
        <div className="grid grid-cols-3 gap-4">
          {["a", "b", "c"].map((k) => (
            <div key={k} className="space-y-1">
              <div className="h-3 w-16 bg-muted rounded" />
              <div className="h-5 w-24 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Budget category cards */}
      <div className="space-y-3">
        {["c1", "c2", "c3", "c4", "c5"].map((k) => (
          <div key={k} className="rounded-xl border border-border bg-card p-4 animate-pulse">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="size-8 bg-muted rounded-lg" />
                <div className="h-4 w-28 bg-muted rounded" />
              </div>
              <div className="h-4 w-20 bg-muted rounded" />
            </div>
            <div className="h-2 w-full bg-muted rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
