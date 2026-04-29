import { Sparkles } from "lucide-react";
import AnalystClient from "./AnalystClient";

// Server shell merender heading instan (LCP element).
// Konten interaktif (laporan, tombol predict/CSV/PDF) di-render oleh
// `AnalystClient` setelah hydrate.
export default function AnalystPage() {
  return (
    <div className="flex flex-col w-full print:bg-white print:text-black">
      <div className="mx-auto w-full max-w-5xl px-4 md:px-8 py-8 space-y-8">
        <div className="space-y-1 mt-4 md:mt-2">
          <h2 className="text-3xl font-semibold tracking-tight-h2 text-foreground flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            AI Financial Analyst
          </h2>
          <p className="text-[15px] text-muted-foreground max-w-md">
            Evaluasi kinerja keuangan bulan ini dengan analisis AI otomatis. Cari tahu kebiasaan borosmu!
          </p>
        </div>
        <div className="h-px bg-border print:hidden" />
        <AnalystClient />
      </div>
    </div>
  );
}
