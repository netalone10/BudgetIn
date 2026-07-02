export default function AdminLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between mt-4 md:mt-2">
        <div className="space-y-1">
          <div className="h-8 w-40 bg-muted rounded-lg animate-pulse" />
          <div className="h-4 w-56 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-9 w-28 bg-muted rounded-lg animate-pulse" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {["s1", "s2", "s3", "s4"].map((k) => (
          <div key={k} className="rounded-xl border border-border bg-card p-4 animate-pulse space-y-2">
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-6 w-24 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-[24px] border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center gap-4 px-5 py-3 border-b border-border bg-muted/40">
          {["w-12", "flex-1", "w-24", "w-20"].map((w, i) => (
            <div key={i} className={`h-4 ${w} bg-muted rounded animate-pulse`} />
          ))}
        </div>
        {["r1", "r2", "r3", "r4", "r5"].map((k) => (
          <div key={k} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-b-0">
            <div className="h-4 w-12 bg-muted rounded animate-pulse" />
            <div className="h-4 flex-1 bg-muted rounded animate-pulse" />
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
