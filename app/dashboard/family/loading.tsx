export default function FamilyLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between mt-4 md:mt-2">
        <div className="space-y-1">
          <div className="h-8 w-36 bg-muted rounded-lg animate-pulse" />
          <div className="h-4 w-56 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-9 w-28 bg-muted rounded-lg animate-pulse" />
      </div>

      {/* Family info card */}
      <div className="rounded-xl border border-border bg-card p-5 animate-pulse space-y-3">
        <div className="flex items-center gap-3">
          <div className="size-10 bg-muted rounded-full" />
          <div className="space-y-1.5">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-3 w-48 bg-muted rounded" />
          </div>
        </div>
      </div>

      {/* Dashboard cards */}
      <div className="grid grid-cols-2 gap-3">
        {["a", "b"].map((k) => (
          <div key={k} className="rounded-xl border border-border bg-card p-4 animate-pulse space-y-2">
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-6 w-28 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* Member list */}
      <div className="space-y-3">
        {["m1", "m2", "m3"].map((k) => (
          <div key={k} className="rounded-xl border border-border bg-card p-4 animate-pulse flex items-center gap-4">
            <div className="size-10 bg-muted rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="h-3 w-24 bg-muted rounded" />
            </div>
            <div className="h-4 w-20 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
