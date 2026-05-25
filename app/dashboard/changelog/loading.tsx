export default function ChangelogLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 md:p-8 space-y-6">
      <div className="space-y-1 mt-4 md:mt-2">
        <div className="h-8 w-32 bg-muted rounded-lg animate-pulse" />
        <div className="h-4 w-48 bg-muted rounded animate-pulse" />
      </div>

      <div className="space-y-6">
        {["v1", "v2", "v3"].map((k) => (
          <div key={k} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
              <div className="h-3 w-24 bg-muted rounded animate-pulse" />
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 animate-pulse space-y-2">
              {["a", "b", "c"].map((r) => (
                <div key={r} className="flex items-start gap-2">
                  <div className="size-4 bg-muted rounded shrink-0 mt-0.5" />
                  <div className="h-3 flex-1 bg-muted rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
