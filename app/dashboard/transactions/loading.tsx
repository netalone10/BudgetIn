export default function TransactionsLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 md:p-8 space-y-6">
      <div className="space-y-1 pb-2 mt-4 md:mt-2">
        <div className="h-8 w-28 bg-muted rounded-lg animate-pulse" />
        <div className="h-4 w-52 bg-muted rounded animate-pulse" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <div className="h-9 w-32 bg-muted rounded-lg animate-pulse" />
        <div className="h-9 w-28 bg-muted rounded-lg animate-pulse" />
        <div className="h-9 w-24 bg-muted rounded-lg animate-pulse" />
        <div className="ml-auto h-9 w-36 bg-muted rounded-lg animate-pulse" />
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {["income", "expense", "net"].map((k) => (
          <div key={k} className="rounded-xl border border-border bg-card p-4 animate-pulse space-y-2">
            <div className="h-3 w-14 bg-muted rounded" />
            <div className="h-5 w-24 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-[24px] border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center gap-4 px-5 py-3 border-b border-border bg-muted/40">
          {["w-12", "flex-1", "w-24", "w-24", "w-16"].map((w, i) => (
            <div key={i} className={`h-4 ${w} bg-muted rounded animate-pulse`} />
          ))}
        </div>
        {["r1", "r2", "r3", "r4", "r5", "r6", "r7"].map((k) => (
          <div key={k} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-b-0">
            <div className="h-4 w-12 bg-muted rounded animate-pulse" />
            <div className="h-4 flex-1 bg-muted rounded animate-pulse" />
            <div className="h-6 w-24 bg-muted rounded-full animate-pulse" />
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            <div className="h-4 w-16 bg-muted rounded animate-pulse" />
          </div>
        ))}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20">
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="h-7 w-8 bg-muted rounded animate-pulse" />
            <div className="h-7 w-8 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
