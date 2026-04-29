import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { fetchDashboardData } from "@/lib/dashboard-data";
import DashboardClient from "./DashboardClient";
import DashboardSuspenseFallback from "./DashboardSuspenseFallback";

/**
 * Streaming SSR shell:
 *  - Greeting is rendered immediately (LCP element) without waiting for data.
 *  - Heavy data fetch is wrapped in <Suspense>, streamed in when ready.
 *  - Auth guard is server-side here; client no longer needs to redirect on
 *    unauthenticated state.
 */
export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/");

  const firstName = session.user?.name?.split(" ")[0] ?? "";

  return (
    <div className="flex flex-col w-full">
      <div className="mx-auto w-full max-w-5xl px-4 md:px-8 py-8 space-y-6">
        {/* LCP element — renders on first byte, no data dependency. */}
        <div className="space-y-1 pb-2 mt-4 md:mt-2">
          <h2 className="text-3xl font-semibold tracking-tight-h2 text-foreground">
            Halo, {firstName}
          </h2>
          <p className="text-[15px] text-muted-foreground">
            Ketik transaksi, set budget, atau minta laporan.
          </p>
        </div>

        <Suspense fallback={<DashboardSuspenseFallback />}>
          <DashboardData />
        </Suspense>
      </div>
    </div>
  );
}

async function DashboardData() {
  const initialData = await fetchDashboardData();
  return <DashboardClient initialData={initialData} />;
}
