export default function AccountsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Summary hero skeleton */}
      <div className="rounded-2xl border border-border bg-card p-5 animate-pulse">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="h-3 w-20 bg-muted rounded mb-2 mx-auto" />
            <div className="h-6 w-28 bg-muted rounded mx-auto" />
          </div>
          <div>
            <div className="h-3 w-24 bg-muted rounded mb-2 mx-auto" />
            <div className="h-7 w-32 bg-muted rounded mx-auto" />
          </div>
          <div>
            <div className="h-3 w-20 bg-muted rounded mb-2 mx-auto" />
            <div className="h-6 w-28 bg-muted rounded mx-auto" />
          </div>
        </div>
      </div>

      {/* Account list skeleton */}
      <div className="space-y-6">
        {[1, 2].map((g) => (
          <section key={g}>
            <div className="h-3 w-24 bg-muted rounded mb-3 animate-pulse" />
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 rounded-xl border border-border bg-card animate-pulse" />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
