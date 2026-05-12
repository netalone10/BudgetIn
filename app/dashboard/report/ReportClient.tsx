"use client";

import { useState } from "react";
import { Calendar, CalendarRange, Download, Loader2, Printer, Sparkles } from "lucide-react";
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
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const element = document.getElementById("report-content");
      if (!element) return;
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "pt", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Report_${variant}_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch {
      alert("Gagal membuat PDF. Coba lagi.");
    } finally {
      setDownloadingPdf(false);
    }
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

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="h-9">
            <Printer className="size-4 mr-2" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={downloadingPdf} className="h-9">
            {downloadingPdf ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Download className="size-4 mr-2" />}
            Unduh PDF
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300 print:hidden">
        <strong>Mode Mockup.</strong> Halaman ini menampilkan contoh laporan dengan data sampel. Belum tersambung ke transaksi real.
      </div>

      <div id="report-content" className="bg-background p-2 rounded-3xl">
        {variant === "monthly" && <MonthlyReport />}
        {variant === "custom" && <CustomRangeReport />}
        {variant === "yearly" && <YearlyReport />}
      </div>
    </>
  );
}
