"use client";

import { useEffect, useState } from "react";
import { Calendar, CalendarRange, Printer, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import MonthlyReport from "./MonthlyReport";
import CustomRangeReport from "./CustomRangeReport";
import YearlyReport from "./YearlyReport";

type Variant = "monthly" | "custom" | "yearly";

const TABS: { id: Variant; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "monthly", label: "Bulanan", icon: Calendar },
  { id: "custom", label: "Custom Range", icon: CalendarRange },
  { id: "yearly", label: "Tahunan", icon: Sparkles },
];

export default function ReportClient() {
  const [variant, setVariant] = useState<Variant>("monthly");

  // Tandai <html> sebagai halaman report yang sedang aktif. Saat print,
  // CSS akan menyembunyikan seluruh chrome aplikasi (sidebar, mobile
  // topbar, banner) dan hanya menampilkan #report-content.
  // Kelas `print-landscape` ikut diatur agar @page landscape aktif untuk
  // varian Tahunan.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("printing-report");
    root.classList.toggle("print-landscape", variant === "yearly");
    return () => {
      root.classList.remove("printing-report");
      root.classList.remove("print-landscape");
    };
  }, [variant]);

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between print:hidden">
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-border bg-muted/30 p-1.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === variant;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setVariant(tab.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-pressed={active}
              >
                <Icon className="size-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <Button variant="outline" size="sm" onClick={handlePrint} className="h-9">
          <Printer className="size-4 mr-2" /> Print / Simpan PDF
        </Button>
      </div>

      <div id="report-content" className="bg-background p-2 rounded-3xl print:p-0 print:bg-white">
        {/* Print-only header — muncul di atas halaman cetak / PDF */}
        <div className="hidden print:block mb-4 pb-3 border-b border-black/30">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-black/60">BudgetIn — Laporan Keuangan</p>
              <p className="text-base font-bold text-black">
                {variant === "monthly" && "Laporan Bulanan"}
                {variant === "custom" && "Laporan Custom Range"}
                {variant === "yearly" && "Laporan Tahunan"}
              </p>
            </div>
            <p className="text-[10px] text-black/60">
              Dicetak {new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>

        {variant === "monthly" && <MonthlyReport />}
        {variant === "custom" && <CustomRangeReport />}
        {variant === "yearly" && <YearlyReport />}

        {/* Print-only footer */}
        <div className="hidden print:block mt-6 pt-3 border-t border-black/30 text-[9px] text-black/50 text-center">
          BudgetIn · {variant === "monthly" && "Laporan Bulanan"}{variant === "custom" && "Laporan Custom Range"}{variant === "yearly" && "Laporan Tahunan"} · Halaman ini di-generate otomatis
        </div>
      </div>
    </>
  );
}
