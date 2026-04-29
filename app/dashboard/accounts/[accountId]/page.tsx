import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { fetchAccountDetail } from "@/lib/account-detail-data";
import AccountDetailClient from "./AccountDetailClient";
import AccountDetailSkeleton from "./AccountDetailSkeleton";

type Props = { params: Promise<{ accountId: string }> };

// Server shell merender heading + back-link instan (LCP element)
// dan stream konten data via Suspense boundary.
export default async function AccountDetailPage({ params }: Props) {
  const { accountId } = await params;
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <Link
        href="/dashboard/accounts"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight-h2 text-foreground">
        Detail Akun
      </h1>
      <Suspense fallback={<AccountDetailSkeleton />}>
        <AccountDetailLoader accountId={accountId} />
      </Suspense>
    </div>
  );
}

async function AccountDetailLoader({ accountId }: { accountId: string }) {
  const data = await fetchAccountDetail(accountId);
  if (!data) notFound();
  return <AccountDetailClient initialData={data} />;
}
