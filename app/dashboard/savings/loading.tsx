export default function SavingsLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between mt-4 md:mt-2">
        <div className="space-y-1">
          <div className="h-8 w-36 bg-muted rounded-lg animate-pulse" />
          <div className="h-4 w-52 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-9 w-28 bg-muted rounded-lg animate-pulse" />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        {["a", "b"].map((k) => (
          <div key={k} className="rounded-xl border border-border bg-card p-4 animate-pulse space-y-2">
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-6 w-28 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* Goal cards */}
      <div className="space-y-4">
        {["g1", "g2", "g3"].map((k) => (
          <div key={k} className="rounded-2xl border border-border bg-card p-5 animate-pulse space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <div className="h-5 w-40 bg-muted rounded" />
                <div className="h-3 w-28 bg-muted rounded" />
              </div>
              <div className="size-10 bg-muted rounded-xl" />
            </div>
            <div className="h-2.5 w-full bg-muted rounded-full" />
            <div className="flex justify-between">
              <div className="h-3 w-24 bg-muted rounded" />
              <div className="h-3 w-16 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
