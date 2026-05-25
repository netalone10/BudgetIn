export default function BackupRestoreLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 md:p-8 space-y-6">
      <div className="space-y-1 mt-4 md:mt-2">
        <div className="h-8 w-40 bg-muted rounded-lg animate-pulse" />
        <div className="h-4 w-60 bg-muted rounded animate-pulse" />
      </div>

      {/* Backup card */}
      <div className="rounded-2xl border border-border bg-card p-6 animate-pulse space-y-4">
        <div className="h-5 w-24 bg-muted rounded" />
        <div className="h-4 w-72 bg-muted rounded" />
        <div className="h-10 w-36 bg-muted rounded-lg" />
      </div>

      {/* Restore card */}
      <div className="rounded-2xl border border-border bg-card p-6 animate-pulse space-y-4">
        <div className="h-5 w-28 bg-muted rounded" />
        <div className="h-4 w-64 bg-muted rounded" />
        <div className="h-28 w-full bg-muted rounded-xl" />
        <div className="h-10 w-36 bg-muted rounded-lg" />
      </div>
    </div>
  );
}
