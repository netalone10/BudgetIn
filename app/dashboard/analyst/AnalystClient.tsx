"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Loader2, Sparkles, AlertTriangle, CheckCircle2, Download, Printer, ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Transaction {
  date: string;
  category: string;
  type: "expense" | "income";
  amount: number;
  note?: string;
}

interface AIReport {
  summary: string;
  healthScore: number;
  anomalies: string[];
  recommendations: string[];
  savingsRate: number;
  totalIncome: number;
  totalSpent: number;
  categoryPercentages: Record<string, number>;
  topExpenses: { date: string; description: string; category: string; amount: number }[];
  dailyAvgSpending: number;
  fmRecommendations: string[];
}

interface PredictionResult {
  predictions: { category: string; history: number[]; predicted: number; trend: "up" | "down" | "stable" }[];
  totalPredicted: number;
  basedOnMonths: string[];
  insight: string;
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

  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [predLoading, setPredLoading] = useState(false);
  const [predError, setPredError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyst?period=bulan ini");
      if (!res.ok) throw new Error("Gagal mengambil analisis");
      const data = await res.json();
      setReport(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan sistem.");
    } finally {
      setLoading(false);
    }
  };

  const handlePredict = async () => {
    setPredLoading(true);
    setPredError(null);
    try {
      const res = await fetch("/api/prediction");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengambil prediksi");
      setPrediction(data);
    } catch (err: unknown) {
      setPredError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setPredLoading(false);
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
      const rows = txs.map((t: Transaction) =>
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
    <>
      {/* Action bar — heading dirender di server shell */}
      <div className="flex items-center justify-end gap-2 print:hidden flex-wrap">
        <Button variant="outline" size="sm" onClick={handlePredict} disabled={predLoading} className="h-9">
          {predLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TrendingUp className="h-4 w-4 mr-2" />}
          Prediksi Bulan Depan
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownloadCsv} disabled={downloadingCsv} className="h-9">
          {downloadingCsv ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          CSV
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrintPdf} disabled={downloadingPdf} className="h-9">
          {downloadingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
          Unduh PDF
        </Button>
      </div>

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

        {/* Prediction Error */}
        {predError && (
          <div className="rounded-[24px] border border-destructive/20 bg-destructive/5 p-4 flex items-center gap-3 print:hidden">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{predError}</p>
          </div>
        )}

        {/* Prediction Result */}
        {prediction && !predLoading && (
          <div className="rounded-[24px] border border-border bg-card shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500 print:hidden">
            <div className="px-6 py-4 border-b bg-muted/30 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Prediksi Pengeluaran Bulan Depan
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Berdasarkan data {prediction.basedOnMonths.join(", ")}
                </p>
              </div>
              <span className="text-sm font-bold tabular-nums text-destructive shrink-0">
                Est. Rp {prediction.totalPredicted.toLocaleString("id-ID")}
              </span>
            </div>

            {prediction.insight && (
              <div className="px-6 py-3 border-b bg-primary/5 text-sm text-foreground/80 italic">
                {prediction.insight}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="py-2.5 pl-6 pr-3 text-left text-[11px] font-medium text-muted-foreground">Kategori</th>
                    {prediction.basedOnMonths.map((m) => (
                      <th key={m} className="py-2.5 pr-3 text-right text-[11px] font-medium text-muted-foreground">{m}</th>
                    ))}
                    <th className="py-2.5 pr-3 text-right text-[11px] font-medium text-muted-foreground">Tren</th>
                    <th className="py-2.5 pr-6 text-right text-[11px] font-medium text-muted-foreground">Prediksi</th>
                  </tr>
                </thead>
                <tbody>
                  {prediction.predictions.map((p) => (
                    <tr key={p.category} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                      <td className="py-3 pl-6 pr-3 text-sm font-medium">{p.category}</td>
                      {p.history.map((v, i) => (
                        <td key={i} className="py-3 pr-3 text-right text-xs text-muted-foreground tabular-nums">
                          {v > 0 ? `${(v / 1000).toFixed(0)}rb` : "—"}
                        </td>
                      ))}
                      <td className="py-3 pr-3 text-right">
                        {p.trend === "up" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                            <TrendingUp className="h-3 w-3" /> Naik
                          </span>
                        ) : p.trend === "down" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                            <TrendingDown className="h-3 w-3" /> Turun
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                            <Minus className="h-3 w-3" /> Stabil
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-6 text-right text-sm font-semibold tabular-nums">
                        Rp {p.predicted.toLocaleString("id-ID")}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/20">
                    <td className="py-2.5 pl-6 text-xs font-semibold text-muted-foreground" colSpan={prediction.basedOnMonths.length + 2}>
                      Total Prediksi
                    </td>
                    <td className="py-2.5 pr-6 text-right text-sm font-bold tabular-nums text-destructive">
                      Rp {prediction.totalPredicted.toLocaleString("id-ID")}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
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

              {/* Category Breakdown */}
              {Object.keys(report.categoryPercentages).length > 0 && (
                <section className="rounded-[24px] border border-border bg-card p-6 shadow-sm">
                  <span className="label-mono text-muted-foreground mb-4 block">04 / Breakdown Kategori</span>
                  <div className="space-y-3">
                    {Object.entries(report.categoryPercentages)
                      .sort(([, a], [, b]) => b - a)
                      .map(([cat, pct]) => (
                        <div key={cat}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-foreground">{cat}</span>
                            <span className="text-muted-foreground tabular-nums">{pct.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-500"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </section>
              )}

              {/* Top Expenses */}
              {report.topExpenses.length > 0 && (
                <section className="rounded-[24px] border border-border bg-card p-6 shadow-sm">
                  <span className="label-mono text-muted-foreground mb-4 block">05 / Pengeluaran Terbesar</span>
                  <ul className="divide-y divide-border">
                    {report.topExpenses.map((tx, i) => (
                      <li key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-mono text-muted-foreground w-4 shrink-0">{i + 1}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{tx.description}</p>
                            <p className="text-xs text-muted-foreground">{tx.category} · {tx.date}</p>
                          </div>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-destructive shrink-0 ml-3">
                          Rp {tx.amount.toLocaleString("id-ID")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* FM Recommendations */}
              {report.fmRecommendations.length > 0 && (
                <section className="rounded-[24px] border border-border bg-card p-6 shadow-sm">
                  <span className="label-mono text-muted-foreground mb-4 block">06 / Rekomendasi Otomatis</span>
                  <ul className="space-y-3">
                    {report.fmRecommendations.map((rec, i) => (
                      <li key={i} className="text-[15px] leading-relaxed text-foreground">{rec}</li>
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
              
              {/* Savings Rate */}
              {report.totalIncome > 0 && (
                <div className="rounded-[24px] border border-border bg-card p-6 shadow-sm space-y-4">
                  <span className="label-mono text-muted-foreground block">Savings Rate</span>
                  <div className={cn(
                    "text-3xl font-bold tabular-nums",
                    report.savingsRate >= 20 ? "text-[#0fa76e]" : report.savingsRate >= 10 ? "text-yellow-600" : "text-destructive"
                  )}>
                    {report.savingsRate.toFixed(1)}%
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Pemasukan</span>
                      <span className="tabular-nums font-medium text-[#0fa76e]">Rp {report.totalIncome.toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Pengeluaran</span>
                      <span className="tabular-nums font-medium text-destructive">Rp {report.totalSpent.toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground pt-1 border-t">
                      <span>Rata-rata/hari</span>
                      <span className="tabular-nums font-medium">Rp {report.dailyAvgSpending.toLocaleString("id-ID")}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="print:hidden">
                <Button onClick={handleGenerate} variant="outline" className="w-full rounded-xl">
                  🔄 Refresh Analisis
                </Button>
              </div>
            </div>

          </div>
        )}
    </>
  );
}
