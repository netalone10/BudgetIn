import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getCachedDashboardData } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import DashboardClient from "./DashboardClient";
import DashboardSuspenseFallback from "./DashboardSuspenseFallback";
import GoogleSetupRecovery from "./GoogleSetupRecovery";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/");
  const userId = session.userId;

  const setupState = await getGoogleSetupState(userId);
  if (setupState === "reconnect") return <GoogleSetupRecovery mode="reconnect" />;
  if (setupState === "migrate") return <GoogleSetupRecovery mode="migrate" />;

  return (
    <div className="flex w-full flex-col">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <Suspense fallback={<DashboardSuspenseFallback />}>
          <DashboardData userId={userId} />
        </Suspense>
      </div>
    </div>
  );
}

async function DashboardData({ userId }: { userId: string }) {
  const initialData = await getCachedDashboardData(userId);
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
