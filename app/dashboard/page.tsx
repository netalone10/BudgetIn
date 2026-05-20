import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getCachedDashboardData } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import DashboardClient from "./DashboardClient";
import {
  KPISectionFallback,
  SecondarySectionFallback,
} from "./DashboardSuspenseFallback";
import GoogleSetupRecovery from "./GoogleSetupRecovery";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/");
  const userId = session.userId;

  const setupState = await getGoogleSetupState(userId);
  if (setupState === "reconnect") return <GoogleSetupRecovery mode="reconnect" />;
  if (setupState === "migrate") return <GoogleSetupRecovery mode="migrate" />;

  return (
    <div className="flex w-full min-w-0 flex-col">
        <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 px-4 py-6 md:gap-8 md:px-8 md:py-8">
        {/* KPI/summary data (today's summary, net worth) streams first
            with its own Suspense boundary — reduced TTFB for critical metrics.
            Uses the cached dashboard data which resolves quickly from the
            cross-request TTL cache on subsequent loads. */}
        <Suspense fallback={<KPISectionFallback />}>
          <DashboardKPIData userId={userId} />
        </Suspense>

        {/* Transaction history and budget details stream progressively
            with a separate Suspense boundary. The full interactive dashboard
            content renders here after the KPI section has already flushed. */}
        <Suspense fallback={<SecondarySectionFallback />}>
          <DashboardSecondaryData userId={userId} />
        </Suspense>
      </div>
    </div>
  );
}

/**
 * KPI/summary async component — streams first.
 * Fetches the cached dashboard data and renders DashboardClient in "kpi-only"
 * mode, showing only the greeting and KPI cards. This lightweight render
 * flushes to the client quickly, giving users immediate feedback on their
 * financial summary while heavier data loads below.
 */
async function DashboardKPIData({ userId }: { userId: string }) {
  const initialData = await getCachedDashboardData(userId);
  return (
    <DashboardClient
      initialData={initialData}
      renderMode="kpi-only"
    />
  );
}

/**
 * Secondary data async component — streams progressively after KPI.
 * Fetches the same cached data (deduplicated by React cache() within the
 * same server render) and renders DashboardClient in "secondary-only" mode
 * with the interactive content: AI input, transaction history, budget sidebar.
 * Below-the-fold components continue using dynamic imports with skeleton placeholders.
 */
async function DashboardSecondaryData({ userId }: { userId: string }) {
  const initialData = await getCachedDashboardData(userId);
  return (
    <DashboardClient
      initialData={initialData}
      renderMode="secondary-only"
    />
  );
}

async function getGoogleSetupState(userId: string): Promise<"ready" | "reconnect" | "migrate"> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { googleId: true, sheetsId: true, googleSetupMigratedAt: true },
    });
    if (!user?.googleId) return "ready";
    if (!user.sheetsId) return "reconnect";
    if (user.googleSetupMigratedAt) return "ready";

    const [accounts, transactions, budgets] = await Promise.all([
      prisma.account.count({ where: { userId } }),
      prisma.transaction.count({ where: { userId } }),
      prisma.budget.count({ where: { userId } }),
    ]);
    return accounts + transactions + budgets > 0 ? "migrate" : "ready";
  } catch (error) {
    console.error("Failed to get Google setup state:", error);
    return "ready";
  }
}
