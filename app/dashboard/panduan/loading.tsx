export default function PanduanLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 md:p-8 space-y-6">
      <div className="space-y-1 mt-4 md:mt-2">
        <div className="h-8 w-28 bg-muted rounded-lg animate-pulse" />
        <div className="h-4 w-52 bg-muted rounded animate-pulse" />
      </div>

      <div className="space-y-4">
        {["s1", "s2", "s3"].map((k) => (
          <div key={k} className="rounded-2xl border border-border bg-card p-6 animate-pulse space-y-3">
            <div className="h-5 w-40 bg-muted rounded" />
            <div className="space-y-2">
              <div className="h-3 w-full bg-muted rounded" />
              <div className="h-3 w-5/6 bg-muted rounded" />
              <div className="h-3 w-4/5 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
