import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { cn } from "@/lib/utils";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "BudgetIn",
  description: "Catat pengeluaran, pahami uangmu — cukup dengan ketik.",
  verification: {
    google: "5ee8c7cbea14c8b4",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning className={cn("font-sans", GeistSans.variable)}>
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
