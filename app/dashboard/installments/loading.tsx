export default function InstallmentsLoading() {
  return (
    <div className="flex min-w-0 flex-col w-full">
      <div className="mx-auto w-full max-w-5xl px-4 md:p-8 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mt-4 md:mt-2">
          <div className="h-4 w-16 bg-muted rounded animate-pulse" />
          <div className="h-4 w-4 bg-muted rounded animate-pulse" />
          <div className="h-4 w-20 bg-muted rounded animate-pulse" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-7 bg-muted rounded animate-pulse" />
            <div className="space-y-1">
              <div className="h-7 w-32 bg-muted rounded animate-pulse" />
              <div className="h-4 w-48 bg-muted rounded animate-pulse" />
            </div>
          </div>
          <div className="h-9 w-28 bg-muted rounded-lg animate-pulse" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {["a", "b", "c"].map((k) => (
            <div
              key={k}
              className="rounded-xl border border-border bg-card p-4 animate-pulse space-y-2"
            >
              <div className="h-3 w-20 bg-muted rounded" />
              <div className="h-6 w-28 bg-muted rounded" />
            </div>
          ))}
        </div>

        {/* List */}
        <div className="space-y-3">
          {["i1", "i2", "i3"].map((k) => (
            <div
              key={k}
              className="rounded-2xl border border-border bg-card p-5 animate-pulse space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <div className="h-5 w-40 bg-muted rounded" />
                  <div className="h-3 w-28 bg-muted rounded" />
                </div>
                <div className="h-6 w-16 bg-muted rounded-full" />
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
    </div>
  );
}
