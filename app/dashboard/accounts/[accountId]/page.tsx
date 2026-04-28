import { notFound } from "next/navigation";
import { fetchAccountDetail } from "@/lib/account-detail-data";
import AccountDetailClient from "./AccountDetailClient";

type Props = { params: Promise<{ accountId: string }> };

export default async function AccountDetailPage({ params }: Props) {
  const { accountId } = await params;
  const data = await fetchAccountDetail(accountId);

  if (!data) notFound();

  return <AccountDetailClient initialData={data} />;
}
