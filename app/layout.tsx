import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import Providers from "@/components/Providers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BudgetIn",
  description: "Catat pengeluaran, pahami uangmu — cukup dengan ketik.",
  verification: {
    google: "5ee8c7cbea14c8b4",
  },
};

export const viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={cn(
        inter.variable,
        geistMono.variable
      )}
    >
      <body className="antialiased">
        <Providers>
          {children}
          <Analytics />
          <SpeedInsights />
        </Providers>
      </body>
    </html>
  );
}
