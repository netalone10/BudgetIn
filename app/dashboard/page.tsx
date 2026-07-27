import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getCachedDashboardData } from "@/lib/cache";
import DashboardClient from "./DashboardClient";

/**
 * Dashboard page — server-side data fetching with TTL cache.
 * getCachedDashboardData fetches all dashboard data (transactions, budgets,
 * accounts, categories) in one shot with 60s cross-request cache.
 * Result is passed as initialData to DashboardClient which renders instantly
 * without any client-side fetch on initial load.
 */
export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/");

  const initialData = await getCachedDashboardData(session.userId);

  return <DashboardClient initialData={initialData} />;
}
