import type { Metadata } from "next";
import LandingPage, { type LandingStats, type LandingTestimonial } from "@/components/landing/LandingPage";
import { getAppMetrics, formatMetricCount, formatRating } from "@/lib/app-metrics";
import { prisma } from "@/lib/prisma";

// ISR: cache 10 menit di edge supaya stats real tapi LCP tetap cepat.
// Bypass `force-static` karena landing sekarang fetch data dari DB.
export const revalidate = 600;

export const metadata: Metadata = {
  title: "BudgetIn — Catat Pengeluaran & Kelola Keuangan Pribadi",
  description:
    "Catat pengeluaran seperti chat. BudgetIn bantu kamu pahami keuangan harian dengan AI, budget otomatis, dan insight yang actionable.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "BudgetIn — Catat Pengeluaran & Kelola Keuangan Pribadi",
    description:
      "Catat transaksi seperti chat, pahami pola pengeluaran, dan kelola budget pribadi dengan lebih ringan bersama BudgetIn.",
    url: "/",
  },
};

export default async function Page() {
  const [metrics, testimonials] = await Promise.all([
    getAppMetrics().catch((err) => {
      console.error("[landing] getAppMetrics failed", err);
      return null;
    }),
    prisma.testimonial
      .findMany({
        where: { approved: true },
        orderBy: { approvedAt: "desc" },
        take: 9,
        select: {
          id: true,
          name: true,
          role: true,
          quote: true,
          rating: true,
          avatarBg: true,
        },
      })
      .catch((err) => {
        console.error("[landing] testimonials fetch failed", err);
        return [] as LandingTestimonial[];
      }),
  ]);

  const stats: LandingStats = metrics
    ? {
        userCountLabel: formatMetricCount(metrics.userCount),
        transactionCountLabel: formatMetricCount(metrics.totalTransactionCount),
        ratingLabel: formatRating(metrics.avgRating, metrics.approvedTestimonialCount),
      }
    : {
        userCountLabel: "—",
        transactionCountLabel: "—",
        ratingLabel: "—",
      };

  return <LandingPage stats={stats} testimonials={testimonials} />;
}
