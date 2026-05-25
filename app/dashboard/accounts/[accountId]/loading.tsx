import AccountDetailSkeleton from "./AccountDetailSkeleton";

export default function AccountDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 md:p-8 space-y-4">
      <div className="h-4 w-24 bg-muted rounded animate-pulse" />
      <div className="h-7 w-48 bg-muted rounded animate-pulse" />
      <AccountDetailSkeleton />
    </div>
  );
}
