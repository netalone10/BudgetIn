"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Loader2, Sparkles, AlertTriangle, CheckCircle2, Download, Printer, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AIReport {
  summary: string;
  healthScore: number;
  anomalies: string[];
  recommendations: string[];
}

export default function AIAnalystPage() {
  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/");
    },
  });

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AIReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyst?period=bulan ini");
      if (!res.ok) throw new Error("Gagal mengambil analisis");
      const data = await res.json();
      setReport(data);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan sistem.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCsv = async () => {
    setDownloadingCsv(true);
    try {
      const res = await fetch("/api/record?period=bulan ini");
      const data = await res.json();
      const txs = data.transactions || [];
      
      if (txs.length === 0) {
        alert("Belum ada transaksi di bulan ini untuk diunduh.");
        return;
      }

      const header = "Tanggal,Kategori,Tipe,Nominal,Catatan\n";
      const rows = txs.map((t: any) => 
        `${t.date},"${t.category}",${t.type},${t.amount},"${(t.note || "").replace(/"/g, '""')}"`
      ).join("\n");

      const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(header + rows);
      const link = document.createElement("a");
      link.setAttribute("href", csvContent);
      link.setAttribute("download", `laporan_transaksi_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert("Gagal mengunduh CSV. Coba lagi.");
    } finally {
      setDownloadingCsv(false);
    }
  };

  const handlePrintPdf = async () => {
    setDownloadingPdf(true);
    try {
      const element = document.getElementById("report-content");
      if (!element) return;

      // Lazy load to keep initial page fast
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "pt", "a4");

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`AI_Analyst_Report_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch {
      alert("Gagal membuat PDF. Coba kembali.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Calculate generic health color
  const getHealthColor = (score: number) => {
    if (score >= 80) return "text-[#0fa76e] bg-[#0fa76e]/10 border-[#0fa76e]/20";
    if (score >= 50) return "text-yellow-600 bg-yellow-500/10 border-yellow-500/20";
    return "text-destructive bg-destructive/10 border-destructive/20";
  };

  const ScoreColor = report ? getHealthColor(report.healthScore) : "";

  return (
    <div className="flex flex-col w-full print:bg-white print:text-black">
      <div className="mx-auto w-full max-w-5xl px-4 md:px-8 py-8 space-y-8">
        
        {/* Header Region */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-4 md:mt-2">
          <div className="space-y-1">
            <h2 className="text-3xl font-semibold tracking-tight-h2 text-foreground flex items-center gap-2">
              <Sparkles className="h-7 w-7 text-primary" />
              AI Financial Analyst
            </h2>
            <p className="text-[15px] text-muted-foreground max-w-md">
              Evaluasi kinerja keuangan bulan ini dengan analisis AI otomatis. Cari tahu kebiasaan borosmu!
            </p>
          </div>
          
          <div className="flex items-center gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={handleDownloadCsv} disabled={downloadingCsv} className="h-9">
              {downloadingCsv ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrintPdf} disabled={downloadingPdf} className="h-9">
              {downloadingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
              Unduh PDF
            </Button>
          </div>
        </div>

        <div className="h-px bg-border print:hidden" />

        {/* Empty / Loading State */}
        {!report && !loading && !error && (
          <div className="rounded-[24px] border border-border bg-card p-12 text-center shadow-sm print:hidden">
            <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
              <Sparkles className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Laporan Belum Dibuat</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto text-sm">
              Klik tombol di bawah untuk membangkitkan model AI dan memindai rincian transaksi serta target budget Anda bulan ini.
            </p>
            <Button onClick={handleGenerate} size="lg" className="rounded-full shadow-md font-medium group">
              ⚡ Generate Analisis Bulan Ini
              <ChevronRight className="h-4 w-4 ml-1 opacity-50 group-hover:opacity-100 transition-opacity" />
            </Button>
          </div>
        )}

        {loading && (
          <div className="rounded-[24px] border border-border bg-card p-12 flex flex-col items-center justify-center shadow-sm">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <h3 className="text-[17px] font-semibold animate-pulse">Menghitung matriks keuangan...</h3>
            <p className="text-sm text-muted-foreground">AI sedang menyusun ringkasan eksekutif Anda.</p>
          </div>
        )}

        {error && (
          <div className="rounded-[24px] border border-destructive/20 bg-destructive/5 p-6 shadow-sm text-center">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
            <h3 className="font-semibold text-destructive mb-1">Gagal Diproses</h3>
            <p className="text-sm text-destructive/80 mb-4">{error}</p>
            <Button onClick={handleGenerate} variant="outline" size="sm">Coba Lagi</Button>
          </div>
        )}

        {/* Report Content */}
        {report && !loading && (
          <div id="report-content" className="grid gap-6 md:grid-cols-[1fr_minmax(280px,320px)] animate-in fade-in zoom-in-95 duration-500 bg-background p-2 rounded-3xl">
            
            {/* Main Content */}
            <div className="space-y-6">
              {/* Summary */}
              <section className="rounded-[24px] border border-border bg-card p-6 shadow-sm">
                <span className="label-mono text-muted-foreground mb-3 block">01 / Rangkuman Eksekutif</span>
                <p className="text-lg leading-relaxed text-foreground font-medium">
                  {report.summary}
                </p>
              </section>

              {/* Recommendations */}
              <section className="rounded-[24px] border border-border bg-card p-6 shadow-sm">
                <span className="label-mono text-muted-foreground mb-4 block">02 / Rekomendasi Hemat</span>
                <ul className="space-y-4">
                  {report.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-[15px] leading-relaxed text-foreground">{rec}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Anomalies */}
              {report.anomalies && report.anomalies.length > 0 && (
                <section className="rounded-[24px] border border-destructive/20 bg-destructive/5 p-6 shadow-sm">
                  <span className="label-mono text-destructive/70 mb-4 block">03 / Deteksi Anomali</span>
                  <ul className="space-y-3">
                    {report.anomalies.map((ano, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                        <span className="text-[15px] leading-relaxed text-destructive">{ano}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* Sidebar Stats */}
            <div className="space-y-6">
              <div className="rounded-[24px] border border-border bg-card p-6 flex flex-col items-center text-center shadow-sm">
                <span className="label-mono text-muted-foreground mb-6 block w-full text-left">Health Score</span>
                
                {/* Circular Gauge */}
                <div className={cn("relative flex h-40 w-40 items-center justify-center rounded-full border-8", ScoreColor)}>
                  <div className="flex flex-col">
                    <span className="text-4xl font-bold tracking-tight">{report.healthScore}</span>
                    <span className="text-xs font-medium uppercase tracking-widest opacity-80 mt-1">/ 100</span>
                  </div>
                </div>

                <p className="text-sm text-foreground/80 mt-6 font-medium leading-relaxed">
                  {report.healthScore >= 80 ? "Sangat Sehat! Pertahankan gaya hidup ini." 
                    : report.healthScore >= 50 ? "Batas Wajar. Ada potensi hemat terselubung." 
                    : "Overbudget! Segera evaluasi pengeluaran wajib Anda."}
                </p>
              </div>
              
              <div className="print:hidden">
                <Button onClick={handleGenerate} variant="outline" className="w-full rounded-xl">
                  🔄 Refresh Analisis
                </Button>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
