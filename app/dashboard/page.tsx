import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { toZonedTime } from "date-fns-tz";
import { authOptions } from "@/lib/auth";
import { getCachedDashboardData } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { formatTanggalLengkapID } from "@/lib/format";
import DashboardClient from "./DashboardClient";
import GoogleSetupRecovery from "./GoogleSetupRecovery";

export const revalidate = 30;

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

  // Parallelize: fetch setup state + dashboard data concurrently
  // instead of sequential (setup state first, then dashboard data).
  // This eliminates ~200-500ms of unnecessary sequential wait.
  const [{ state: setupState, name }, initialData] = await Promise.all([
    getGoogleSetupState(userId),
    getCachedDashboardData(userId),
  ]);
  if (setupState === "reconnect") return <GoogleSetupRecovery mode="reconnect" />;
  if (setupState === "migrate") return <GoogleSetupRecovery mode="migrate" />;

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

        {/* KPI/summary: data already resolved above via Promise.all.
            Pass directly — no Suspense needed, no re-fetch. */}
        <DashboardClient
          initialData={initialData}
          renderMode="kpi-only"
        />

        {/* Transaction history and budget details.
            Data already resolved — pass directly. */}
        <DashboardClient
          initialData={initialData}
          renderMode="secondary-only"
        />
      </div>
    </div>
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
