import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { cn } from "@/lib/utils";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Catatuang",
  description: "Catat pengeluaran, pahami uangmu — cukup dengan ketik.",
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
