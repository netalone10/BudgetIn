"use client";

/**
 * Tujuan: Modal onboarding 8-slide untuk user baru — ditampilkan sekali setelah login pertama
 * Caller: components/Sidebar.tsx
 * Dependensi: localStorage (key: budgetin_onboarding_{userId})
 * Main Functions: OnboardingModal
 * Side Effects: localStorage write saat modal ditutup/selesai
 */

import { useState } from "react";
import { X, ChevronLeft, ChevronRight, BookOpen, Wallet, Tags, MessageSquare, PencilLine, Target, Sparkles, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onClose: () => void;
  onOpenPanduan?: () => void;
}

const slides = [
  {
    icon: BookOpen,
    iconBg: "bg-blue-100 dark:bg-blue-950/40",
    iconColor: "text-blue-600 dark:text-blue-400",
    title: "Selamat datang di BudgetIn!",
    desc: "BudgetIn adalah aplikasi manajemen keuangan personal berbasis AI. Catat pemasukan & pengeluaran lewat chat natural, pantau budget, dan dapatkan analisis otomatis.",
    tips: [
      "Tersedia untuk akun Google (data di Google Sheets) dan akun email (data di cloud)",
      "Semua fitur bisa diakses dari sidebar kiri",
    ],
  },
  {
    icon: Wallet,
    iconBg: "bg-emerald-100 dark:bg-emerald-950/40",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    title: "Langkah pertama: Tambah Akun",
    desc: "Buat akun keuanganmu dulu — bank, dompet cash, atau kartu kredit. Setiap transaksi bisa dikaitkan ke akun.",
    tips: [
      "Buka Akun & Dompet dari sidebar",
      "Isi nama akun, tipe, dan saldo awal",
      "Saldo dihitung otomatis dari semua transaksi",
    ],
    example: 'Contoh: "BCA Tabungan", "Cash on Hand", "Mandiri Gold"',
  },
  {
    icon: Tags,
    iconBg: "bg-violet-100 dark:bg-violet-950/40",
    iconColor: "text-violet-600 dark:text-violet-400",
    title: "Tipe Akun: Asset vs Liability",
    desc: "Tipe akun menentukan bagaimana saldo dihitung. Asset = milikmu (bertambah saat income). Liability = utang (kartu kredit, pinjaman).",
    tips: [
      "Asset: tabungan, deposito, dompet cash",
      "Liability: kartu kredit, hutang",
      "Bisa buat tipe custom di menu Tipe Akun",
    ],
  },
  {
    icon: MessageSquare,
    iconBg: "bg-amber-100 dark:bg-amber-950/40",
    iconColor: "text-amber-600 dark:text-amber-400",
    title: "Input Transaksi via AI Prompt",
    desc: "Ketik transaksi pakai bahasa natural di kolom chat dashboard. AI akan otomatis memahami jumlah, kategori, dan akun.",
    tips: [
      "Pengeluaran: sebutkan apa yang dibeli + jumlah",
      "Pemasukan: sebutkan sumber + jumlah",
      "Bisa sebutkan akun spesifik",
    ],
    examples: [
      '"beli makan siang 35rb dari BCA"',
      '"gaji masuk 8jt ke BNI Debit"',
      '"bayar listrik 250rb cash"',
      '"transfer 1jt dari BCA ke BNI"',
    ],
  },
  {
    icon: PencilLine,
    iconBg: "bg-sky-100 dark:bg-sky-950/40",
    iconColor: "text-sky-600 dark:text-sky-400",
    title: "Input Manual & Edit Transaksi",
    desc: "Selain AI prompt, bisa input manual lewat form. Semua transaksi bisa diedit langsung di tabel — klik ikon pensil di baris yang ingin diubah.",
    tips: [
      "Klik ikon pencil (✏️) di baris transaksi untuk edit",
      "Bisa ubah tanggal, deskripsi, kategori, akun, dan jumlah",
      "Tombol form manual ada di atas tabel transaksi",
    ],
  },
  {
    icon: Target,
    iconBg: "bg-orange-100 dark:bg-orange-950/40",
    iconColor: "text-orange-600 dark:text-orange-400",
    title: "Budget: Rencanakan Pengeluaran",
    desc: "Set batas pengeluaran per kategori setiap bulan. Budget variable diproporsikan berdasarkan hari berjalan (prorated), budget fixed (kos, arisan, cicilan) tetap 100%.",
    tips: [
      "Set budget via prompt: \"budget makan 500rb\"",
      "Atau lewat tabel di tab \"vs Budget\" di dashboard",
      "Aktifkan Rollover agar sisa budget terbawa ke bulan berikutnya",
      "Pengeluaran tanpa budget tetap tercatat terpisah",
    ],
  },
  {
    icon: Sparkles,
    iconBg: "bg-pink-100 dark:bg-pink-950/40",
    iconColor: "text-pink-600 dark:text-pink-400",
    title: "Fitur Lanjutan",
    desc: "BudgetIn punya beberapa fitur tambahan yang bisa diakses dari sidebar.",
    features: [
      { label: "Tabungan", desc: "Set goals tabungan + tracking progress otomatis" },
      { label: "Arus Kas (Kartu Kredit)", desc: "Pantau pengeluaran & tagihan per kartu kredit per periode billing" },
      { label: "AI Analyst", desc: "Analisis keuangan mendalam dengan narasi AI — pola pengeluaran, anomali, rekomendasi" },
      { label: "Kelola Kategori", desc: "Tambah/hapus kategori pengeluaran & pemasukan custom" },
    ],
  },
  {
    icon: FileText,
    iconBg: "bg-teal-100 dark:bg-teal-950/40",
    iconColor: "text-teal-600 dark:text-teal-400",
    title: "Laporan AI Otomatis",
    desc: "Minta ringkasan keuangan bulanan langsung dari prompt dashboard. AI akan generate narasi: total pengeluaran, kategori terbesar, vs budget, dan saran.",
    tips: [
      "Ketik di prompt: \"laporan bulan ini\"",
      "Atau: \"ringkasan keuangan April\"",
      "Laporan muncul di tab Laporan di dashboard",
    ],
    closing: "Kamu siap! Mulai dengan menambah akun pertamamu. 🎉",
  },
];

export default function OnboardingModal({ onClose, onOpenPanduan }: Props) {
  const [current, setCurrent] = useState(0);
  const isLast = current === slides.length - 1;
  const slide = slides[current];
  const Icon = slide.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors z-10"
          title="Lewati"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pt-5 pb-2 px-6">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={cn(
                "rounded-full transition-all duration-200",
                i === current
                  ? "w-6 h-2 bg-primary"
                  : i < current
                  ? "w-2 h-2 bg-primary/40"
                  : "w-2 h-2 bg-muted"
              )}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Icon + Title */}
          <div className="flex flex-col items-center text-center gap-3">
            <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center", slide.iconBg)}>
              <Icon className={cn("h-7 w-7", slide.iconColor)} />
            </div>
            <h2 className="text-lg font-bold text-foreground leading-snug">{slide.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{slide.desc}</p>
          </div>

          {/* Example (single) */}
          {"example" in slide && slide.example && (
            <div className="rounded-lg bg-muted/50 px-4 py-2.5 text-xs text-muted-foreground italic text-center">
              {slide.example}
            </div>
          )}

          {/* Examples (multiple) */}
          {"examples" in slide && slide.examples && (
            <div className="rounded-xl border border-border bg-muted/30 divide-y divide-border overflow-hidden">
              {slide.examples.map((ex, i) => (
                <div key={i} className="px-4 py-2 text-xs font-mono text-foreground">
                  {ex}
                </div>
              ))}
            </div>
          )}

          {/* Tips */}
          {"tips" in slide && slide.tips && (
            <ul className="space-y-2">
              {slide.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                    {i + 1}
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          )}

          {/* Features (slide 7) */}
          {"features" in slide && slide.features && (
            <div className="space-y-2">
              {slide.features.map((f, i) => (
                <div key={i} className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                  <p className="text-sm font-medium text-foreground">{f.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                </div>
              ))}
            </div>
          )}

          {/* Closing message */}
          {"closing" in slide && slide.closing && (
            <div className="rounded-xl bg-primary/10 border border-primary/20 px-4 py-3 text-sm text-center font-medium text-primary">
              {slide.closing}
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
          <div className="w-24">
            {current > 0 && (
              <button
                onClick={() => setCurrent((p) => p - 1)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-4 w-4" /> Kembali
              </button>
            )}
          </div>

          <span className="text-xs text-muted-foreground">
            {current + 1} / {slides.length}
          </span>

          <div className="w-24 flex justify-end">
            {isLast ? (
              <button
                onClick={() => { onClose(); onOpenPanduan?.(); }}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Mulai <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => setCurrent((p) => p + 1)}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Lanjut <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
