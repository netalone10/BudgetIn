import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { toZonedTime } from "date-fns-tz";
import { authOptions } from "@/lib/auth";
import { getCachedDashboardData } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { formatTanggalLengkapID } from "@/lib/format";
import DashboardClient from "./DashboardClient";
import {
  KPISectionFallback,
  SecondarySectionFallback,
} from "./DashboardSuspenseFallback";
import GoogleSetupRecovery from "./GoogleSetupRecovery";

const TIMEZONE = "Asia/Jakarta";

function pickGreeting(hour: number): string {
  if (hour < 5) return "Selamat malam";
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/");
  const userId = session.userId;

  const { state: setupState, name } = await getGoogleSetupState(userId);
  if (setupState === "reconnect") return <GoogleSetupRecovery mode="reconnect" />;
  if (setupState === "migrate") return <GoogleSetupRecovery mode="migrate" />;

  // Greeting dirender server-side (di luar Suspense) agar tercat instan sebagai
  // elemen LCP — tidak perlu menunggu fetch data dashboard yang berat. Ini
  // menurunkan LCP /dashboard secara signifikan (sebelumnya konten LCP baru
  // muncul setelah getCachedDashboardData selesai).
  const now = toZonedTime(new Date(), TIMEZONE);
  const greeting = pickGreeting(now.getHours());
  const firstName = name?.split(" ")[0]?.trim();
  const dateLabel = formatTanggalLengkapID(now);

  return (
    <div className="flex w-full min-w-0 flex-col">
        <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 px-4 py-6 md:gap-8 md:px-8 md:py-8">
        {/* Greeting statis server-side — elemen LCP yang tercat lebih dulu. */}
        <header className="relative overflow-hidden rounded-[24px] border border-border/70 bg-gradient-to-br from-primary/10 via-primary/[0.04] to-transparent p-5 shadow-sm md:p-6">
          <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
            {greeting}
            {firstName ? `, ${firstName}` : ""}! <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1.5 text-[13px] font-medium text-muted-foreground">{dateLabel}</p>
        </header>

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

type SetupState = "ready" | "reconnect" | "migrate";

async function getGoogleSetupState(
  userId: string
): Promise<{ state: SetupState; name: string | null }> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, googleId: true, sheetsId: true, googleSetupMigratedAt: true },
    });
    const name = user?.name ?? null;
    if (!user?.googleId) return { state: "ready", name };
    if (!user.sheetsId) return { state: "reconnect", name };
    if (user.googleSetupMigratedAt) return { state: "ready", name };

    const [accounts, transactions, budgets] = await Promise.all([
      prisma.account.count({ where: { userId } }),
      prisma.transaction.count({ where: { userId } }),
      prisma.budget.count({ where: { userId } }),
    ]);
    return { state: accounts + transactions + budgets > 0 ? "migrate" : "ready", name };
  } catch (error) {
    console.error("Failed to get Google setup state:", error);
    return { state: "ready", name: null };
  }
}
