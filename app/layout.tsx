import type { Metadata } from "next";
import { Fira_Code, Lora, Poppins } from "next/font/google";
import { cn } from "@/lib/utils";
import Providers from "@/components/Providers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  variable: "--font-fira-code",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://budget.amuharr.com"),
  applicationName: "BudgetIn",
  title: {
    default: "BudgetIn — Catat Pengeluaran dan Kelola Keuangan Pribadi",
    template: "%s | BudgetIn",
  },
  description:
    "BudgetIn membantu kamu mencatat pengeluaran, memantau saldo, mengatur budget, tagihan, dan tabungan pribadi dengan input cepat berbasis teks.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "https://budget.amuharr.com",
    siteName: "BudgetIn",
    title: "BudgetIn — Catat Pengeluaran dan Kelola Keuangan Pribadi",
    description:
      "Catat transaksi seperti chat, pahami pola pengeluaran, dan kelola budget pribadi dengan lebih ringan bersama BudgetIn.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "BudgetIn - Catat pengeluaran dan kelola keuangan pribadi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BudgetIn — Catat Pengeluaran dan Kelola Keuangan Pribadi",
    description:
      "Catat transaksi seperti chat, pahami pola pengeluaran, dan kelola budget pribadi dengan lebih ringan bersama BudgetIn.",
    images: ["/twitter-image"],
  },
  creator: "Akbar Muharram",
  publisher: "BudgetIn",
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
      className={cn(poppins.variable, firaCode.variable, lora.variable)}
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
