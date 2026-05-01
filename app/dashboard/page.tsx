import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { fetchDashboardData } from "@/lib/dashboard-data";
import DashboardClient from "./DashboardClient";
import DashboardSuspenseFallback from "./DashboardSuspenseFallback";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/");

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

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-muted/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Input
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  Natural language
                </p>
              </div>
              <div className="rounded-2xl bg-primary/10 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-primary/80">
                  Output
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  Budget + insight
                </p>
              </div>
              <div className="rounded-2xl bg-muted/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Rhythm
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  Built for every day
                </p>
              </div>
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
