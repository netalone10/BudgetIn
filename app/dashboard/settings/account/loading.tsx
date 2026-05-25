export default function SettingsAccountLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 md:p-8 space-y-6">
      <div className="space-y-1 mt-4 md:mt-2">
        <div className="h-8 w-36 bg-muted rounded-lg animate-pulse" />
        <div className="h-4 w-52 bg-muted rounded animate-pulse" />
      </div>

      {/* Avatar section */}
      <div className="rounded-2xl border border-border bg-card p-6 animate-pulse flex items-center gap-5">
        <div className="size-20 bg-muted rounded-full shrink-0" />
        <div className="space-y-2">
          <div className="h-5 w-36 bg-muted rounded" />
          <div className="h-4 w-48 bg-muted rounded" />
          <div className="h-8 w-28 bg-muted rounded-lg" />
        </div>
      </div>

      {/* Form fields */}
      <div className="rounded-2xl border border-border bg-card p-6 animate-pulse space-y-5">
        {["name", "email", "currency"].map((k) => (
          <div key={k} className="space-y-1.5">
            <div className="h-3.5 w-20 bg-muted rounded" />
            <div className="h-10 w-full bg-muted rounded-lg" />
          </div>
        ))}
        <div className="h-10 w-full bg-muted rounded-lg" />
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl border border-destructive/30 bg-card p-6 animate-pulse space-y-3">
        <div className="h-4 w-28 bg-muted rounded" />
        <div className="h-4 w-64 bg-muted rounded" />
        <div className="h-9 w-36 bg-muted rounded-lg" />
      </div>
    </div>
  );
}
