import AccountsSkeleton from "./AccountsSkeleton";

export default function AccountsLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 md:p-8 space-y-6">
      <div className="space-y-1 pb-2 mt-4 md:mt-2">
        <div className="h-8 w-32 bg-muted rounded-lg animate-pulse" />
        <div className="h-4 w-56 bg-muted rounded animate-pulse" />
      </div>
      <AccountsSkeleton />
    </div>
  );
}
