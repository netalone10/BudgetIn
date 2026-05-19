import { Suspense } from "react";
import DetailsClient from "./DetailsClient";

export const metadata = { title: "Rincian · BudgetIn" };

export default function DetailsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <header className="mb-5">
        <p className="label-mono text-primary">Detail</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
          Rincian Pemasukan & Pengeluaran
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drill-down per kategori, klik baris untuk lihat transaksi anggotanya.
        </p>
      </header>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
        <DetailsClient />
      </Suspense>
    </div>
  );
}
