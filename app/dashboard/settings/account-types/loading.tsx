export default function AccountTypesLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 md:p-8 space-y-6">
      <div className="space-y-1 mt-4 md:mt-2">
        <div className="h-8 w-40 bg-muted rounded-lg animate-pulse" />
        <div className="h-4 w-56 bg-muted rounded animate-pulse" />
      </div>
      <div className="space-y-3">
        {["t1", "t2", "t3", "t4"].map((k) => (
          <div key={k} className="rounded-xl border border-border bg-card p-4 animate-pulse flex items-center gap-3">
            <div className="size-9 bg-muted rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="h-3 w-48 bg-muted rounded" />
            </div>
            <div className="h-7 w-16 bg-muted rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
