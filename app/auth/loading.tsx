export default function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo / title */}
        <div className="space-y-2 text-center">
          <div className="mx-auto h-8 w-32 bg-muted rounded-lg animate-pulse" />
          <div className="mx-auto h-4 w-48 bg-muted rounded animate-pulse" />
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2">
          <div className="h-10 flex-1 bg-muted rounded-lg animate-pulse" />
          <div className="h-10 flex-1 bg-muted rounded-lg animate-pulse" />
        </div>

        {/* Form fields */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="h-4 w-16 bg-muted rounded animate-pulse" />
            <div className="h-10 w-full bg-muted rounded-lg animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            <div className="h-10 w-full bg-muted rounded-lg animate-pulse" />
          </div>
        </div>

        {/* Submit button */}
        <div className="h-10 w-full bg-muted rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
