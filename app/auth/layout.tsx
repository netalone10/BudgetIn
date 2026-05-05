import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Masuk ke BudgetIn — Kelola Keuangan Pribadi",
  description:
    "Masuk atau daftar ke BudgetIn untuk mencatat transaksi, memantau budget, mengelola tagihan, dan memahami keuangan pribadi.",
  alternates: {
    canonical: "/auth",
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
