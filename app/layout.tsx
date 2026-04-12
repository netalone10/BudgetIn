import type { Metadata } from "next";
import { cn } from "@/lib/utils";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "CatatUang — Catat pengeluaranmu, cukup dengan ketik",
  description: "Catat pengeluaran, pahami uangmu — cukup dengan ketik. AI yang proses sisanya.",
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
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* Serif Design System Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Source+Sans+3:ital,wght@0,300;0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={cn("font-sans antialiased")}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
