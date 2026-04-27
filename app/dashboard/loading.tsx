export default function DashboardLoading() {
  return (
    <div className="flex flex-col w-full">
      <div className="mx-auto w-full max-w-5xl px-4 md:px-8 py-8 space-y-6">
        {/* Greeting */}
        <div className="space-y-2 pb-2 mt-4 md:mt-2">
          <div className="h-9 w-48 bg-muted rounded-lg animate-pulse" />
          <div className="h-5 w-72 bg-muted rounded-md animate-pulse" />
        </div>

        {/* Summary Cards */}
        <div className="flex gap-4">
          <div className="flex-1 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 bg-muted rounded animate-pulse" />
              <div className="h-3.5 w-24 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-7 w-32 bg-muted rounded animate-pulse" />
            <div className="h-3 w-20 bg-muted rounded animate-pulse" />
          </div>
          <div className="flex-1 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 bg-muted rounded animate-pulse" />
              <div className="h-3.5 w-24 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-7 w-32 bg-muted rounded animate-pulse" />
          </div>
        </div>

        {/* Net Worth */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-3.5 bg-muted rounded animate-pulse" />
              <div className="h-3.5 w-28 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-3 w-16 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="flex gap-4">
            <div className="h-3 w-24 bg-muted rounded animate-pulse" />
            <div className="h-3 w-24 bg-muted rounded animate-pulse" />
            <div className="h-3 w-24 bg-muted rounded animate-pulse" />
          </div>
        </div>

        {/* Prompt Input */}
        <div className="space-y-2 mt-2">
          <div className="relative">
            <div className="h-[72px] rounded-[20px] border border-border bg-card shadow-sm animate-pulse" />
            <div className="absolute bottom-2.5 right-2 h-9 w-9 rounded-full bg-muted animate-pulse" />
          </div>
          <div className="h-4 w-56 bg-muted rounded animate-pulse px-2" />
        </div>

        {/* Manual Input */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <div className="h-3 w-20 bg-muted rounded animate-pulse" />
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden space-y-3 p-4">
            {/* Tab bar */}
            <div className="flex border-b border-border pb-2">
              <div className="flex-1 h-9 bg-muted rounded animate-pulse" />
              <div className="flex-1 h-9 bg-muted rounded animate-pulse" />
              <div className="flex-1 h-9 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-10 w-full bg-muted rounded-lg animate-pulse" />
            <div className="h-10 w-full bg-muted rounded-lg animate-pulse" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-10 bg-muted rounded-lg animate-pulse" />
              <div className="h-10 bg-muted rounded-lg animate-pulse" />
            </div>
            <div className="h-9 w-full bg-muted rounded-md animate-pulse" />
          </div>
        </div>

        {/* Dashboard Tabs */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex border-b border-border px-4">
            <div className="h-10 w-24 bg-muted rounded animate-pulse m-1" />
            <div className="h-10 w-24 bg-muted rounded animate-pulse m-1" />
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="h-16 bg-muted rounded-lg animate-pulse" />
              <div className="h-16 bg-muted rounded-lg animate-pulse" />
              <div className="h-16 bg-muted rounded-lg animate-pulse" />
            </div>
            <div className="h-32 bg-muted rounded-lg animate-pulse" />
          </div>
        </div>

        {/* Transaction History */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <div className="h-3 w-32 bg-muted rounded animate-pulse" />
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="rounded-[24px] border border-border bg-card overflow-hidden shadow-sm">
            {/* Table header */}
            <div className="flex items-center gap-4 px-5 py-3 border-b border-border bg-muted/40">
              <div className="h-4 w-12 bg-muted rounded animate-pulse" />
              <div className="h-4 flex-1 bg-muted rounded animate-pulse" />
              <div className="h-4 w-20 bg-muted rounded animate-pulse" />
              <div className="h-4 w-20 bg-muted rounded animate-pulse" />
              <div className="h-4 w-16 bg-muted rounded animate-pulse" />
            </div>
            {/* Table rows */}
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-5 py-4 border-b border-border"
              >
                <div className="h-4 w-12 bg-muted rounded animate-pulse" />
                <div className="h-4 flex-1 bg-muted rounded animate-pulse" />
                <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              </div>
            ))}
            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20">
              <div className="h-5 w-32 bg-muted rounded animate-pulse" />
              <div className="flex gap-2">
                <div className="h-7 w-8 bg-muted rounded animate-pulse" />
                <div className="h-7 w-8 bg-muted rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
