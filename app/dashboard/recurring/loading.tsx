export default function RecurringLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between mt-4 md:mt-2">
        <div className="space-y-1">
          <div className="h-8 w-40 bg-muted rounded-lg animate-pulse" />
          <div className="h-4 w-56 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-9 w-28 bg-muted rounded-lg animate-pulse" />
      </div>

      {/* Upcoming strip */}
      <div className="rounded-xl border border-border bg-card p-4 animate-pulse space-y-2">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="flex gap-3">
          {["a", "b", "c"].map((k) => (
            <div key={k} className="h-12 flex-1 bg-muted rounded-lg" />
          ))}
        </div>
      </div>

      {/* Recurring list */}
      <div className="space-y-3">
        {["r1", "r2", "r3", "r4"].map((k) => (
          <div key={k} className="rounded-xl border border-border bg-card p-4 animate-pulse flex items-center gap-4">
            <div className="size-10 bg-muted rounded-xl shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-36 bg-muted rounded" />
              <div className="h-3 w-24 bg-muted rounded" />
            </div>
            <div className="text-right space-y-1">
              <div className="h-4 w-20 bg-muted rounded ml-auto" />
              <div className="h-3 w-16 bg-muted rounded ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
