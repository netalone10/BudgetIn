export default function DetailsLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 md:p-8 space-y-6">
      <div className="space-y-1 mt-4 md:mt-2">
        <div className="h-8 w-36 bg-muted rounded-lg animate-pulse" />
        <div className="h-4 w-52 bg-muted rounded animate-pulse" />
      </div>

      {/* Period filter */}
      <div className="flex flex-wrap gap-2">
        {["a", "b", "c", "d", "e"].map((k) => (
          <div key={k} className="h-8 w-20 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {["income", "expense", "net"].map((k) => (
          <div key={k} className="rounded-xl border border-border bg-card p-4 animate-pulse space-y-2">
            <div className="h-3 w-14 bg-muted rounded" />
            <div className="h-5 w-24 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* Category group list */}
      <div className="space-y-3">
        {["g1", "g2", "g3"].map((k) => (
          <div key={k} className="rounded-xl border border-border bg-card overflow-hidden animate-pulse">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="h-4 w-20 bg-muted rounded" />
            </div>
            {["r1", "r2", "r3"].map((r) => (
              <div key={r} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0">
                <div className="size-7 bg-muted rounded-lg" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-28 bg-muted rounded" />
                  <div className="h-2 bg-muted rounded-full w-2/3" />
                </div>
                <div className="h-4 w-16 bg-muted rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
