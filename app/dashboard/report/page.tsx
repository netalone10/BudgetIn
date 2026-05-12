import { FileText } from "lucide-react";
import ReportClient from "./ReportClient";

export default function ReportPage() {
  return (
    <div className="flex flex-col w-full print:bg-white print:text-black">
      <div className="mx-auto w-full max-w-6xl px-4 md:p-8 space-y-8">
        <div className="space-y-1 mt-4 md:mt-2 print:hidden">
          <h2 className="text-3xl font-semibold tracking-tight-h2 text-foreground flex items-center gap-2">
            <FileText className="size-7 text-primary" />
            Report
          </h2>
          <p className="text-[15px] text-muted-foreground max-w-xl">
            Laporan keuangan terstruktur — pemasukan, pengeluaran, dan net per periode. Pilih varian Bulanan, Custom Range, atau Tahunan, lalu cetak atau unduh PDF.
          </p>
        </div>
        <div className="h-px bg-border print:hidden" />
        <ReportClient />
      </div>
    </div>
  );
}
