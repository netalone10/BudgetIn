import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";

// Auth-aware redirect ditangani di edge oleh `middleware.ts`.
// Halaman ini fully static agar LCP optimal (CDN cache, no DB hit).
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "BudgetIn — Catat Pengeluaran & Kelola Keuangan Pribadi",
  description:
    "Catat pengeluaran seperti chat. BudgetIn bantu kamu pahami keuangan harian dengan AI, budget otomatis, dan insight yang actionable.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "BudgetIn — Catat Pengeluaran & Kelola Keuangan Pribadi",
    description:
      "Catat transaksi seperti chat, pahami pola pengeluaran, dan kelola budget pribadi dengan lebih ringan bersama BudgetIn.",
    url: "/",
  },
};

export default function Page() {
  return <LandingPage />;
}
