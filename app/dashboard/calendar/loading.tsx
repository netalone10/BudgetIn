export default function CalendarLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between mt-4 md:mt-2">
        <div className="space-y-1">
          <div className="h-8 w-28 bg-muted rounded-lg animate-pulse" />
          <div className="h-4 w-48 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-8 bg-muted rounded-lg animate-pulse" />
          <div className="h-9 w-28 bg-muted rounded-lg animate-pulse" />
          <div className="h-9 w-8 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden animate-pulse">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((d) => (
            <div key={d} className="h-10 flex items-center justify-center">
              <div className="h-3 w-6 bg-muted rounded" />
            </div>
          ))}
        </div>
        {/* 5 weeks */}
        {["w1", "w2", "w3", "w4", "w5"].map((w) => (
          <div key={w} className="grid grid-cols-7 border-b border-border last:border-b-0">
            {["d1", "d2", "d3", "d4", "d5", "d6", "d7"].map((d) => (
              <div key={d} className="min-h-[72px] p-1.5 border-r border-border last:border-r-0">
                <div className="h-4 w-4 bg-muted rounded-full mb-1" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
