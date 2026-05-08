import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { fetchDashboardData } from "@/lib/dashboard-data";
import { prisma } from "@/lib/prisma";
import DashboardClient from "./DashboardClient";
import DashboardSuspenseFallback from "./DashboardSuspenseFallback";
import GoogleSetupRecovery from "./GoogleSetupRecovery";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/");

  const setupState = await getGoogleSetupState(session.userId);
  if (setupState === "reconnect") return <GoogleSetupRecovery mode="reconnect" />;
  if (setupState === "migrate") return <GoogleSetupRecovery mode="migrate" />;

  const firstName = session.user?.name?.split(" ")[0] ?? "";

  return (
    <div className="flex w-full flex-col">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <div className="mt-4 rounded-[32px] border border-border/70 bg-card/85 px-6 py-8 shadow-sm backdrop-blur md:px-8">
          <div className="space-y-6">
            <div className="max-w-4xl space-y-3">
              <p className="label-mono text-primary">Daily Command Center</p>
              <h2 className="text-3xl font-semibold tracking-tight-h2 text-foreground md:text-4xl">
                Halo, {firstName}
              </h2>
              <p className="max-w-3xl text-[15px] leading-relaxed text-muted-foreground md:text-[17px]">
                Catat transaksi, pantau ritme pengeluaran, dan ubah data harian
                jadi keputusan finansial yang lebih tenang.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6 py-6">
          <div className="space-y-1 px-1">
            <h3 className="text-xl font-semibold text-foreground">
              Ringkasan kerja hari ini
            </h3>
            <p className="text-[14px] text-muted-foreground">
              Semua blok di bawah ini dibuat untuk mempercepat pencatatan dan membaca kondisi keuanganmu.
            </p>
          </div>

          <Suspense fallback={<DashboardSuspenseFallback />}>
            <DashboardData />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function DashboardData() {
  const initialData = await fetchDashboardData();
  return <DashboardClient initialData={initialData} />;
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
