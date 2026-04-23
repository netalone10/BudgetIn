"use client";

/**
 * Tujuan: Halaman panduan statis untuk user — ringkasan lengkap semua fitur BudgetIn
 * Caller: Sidebar nav link, OnboardingModal (tombol slide terakhir)
 * Dependensi: -
 * Main Functions: PanduanPage
 * Side Effects: -
 */

import { BookOpen, Wallet, Tags, MessageSquare, PencilLine, Target, Sparkles, FileText, CreditCard, PiggyBank, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Section {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  content: React.ReactNode;
}

function Accordion({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);
  const Icon = section.icon;

  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden transition-all", open && "shadow-sm")}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors text-left"
      >
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", section.iconBg)}>
          <Icon className={cn("h-4 w-4", section.iconColor)} />
        </div>
        <span className="flex-1 text-sm font-semibold text-foreground">{section.title}</span>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        }
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-border text-sm text-muted-foreground space-y-3">
          {section.content}
        </div>
      )}
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">✓</span>
      <span>{children}</span>
    </li>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">
      {children}
    </div>
  );
}

const sections: Section[] = [
  {
    icon: Wallet,
    iconBg: "bg-emerald-100 dark:bg-emerald-950/40",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    title: "Tambah Akun & Dompet",
    content: (
      <div className="space-y-3">
        <p>Buka <strong className="text-foreground">Akun & Dompet</strong> dari sidebar. Tambah akun bank, cash, atau kartu kredit sebelum mulai mencatat transaksi.</p>
        <ul className="space-y-1.5">
          <Tip>Isi nama akun, pilih tipe, dan masukkan saldo awal</Tip>
          <Tip>Saldo akun dihitung otomatis dari semua transaksi yang tercatat</Tip>
          <Tip>Bisa tambah banyak akun sekaligus</Tip>
        </ul>
        <Code>Contoh: "BCA Tabungan", "Cash on Hand", "Mandiri Pertamina"</Code>
      </div>
    ),
  },
  {
    icon: Tags,
    iconBg: "bg-violet-100 dark:bg-violet-950/40",
    iconColor: "text-violet-600 dark:text-violet-400",
    title: "Tipe Akun (Asset vs Liability)",
    content: (
      <div className="space-y-3">
        <p>Tipe akun menentukan cara hitung saldo. Atur di menu <strong className="text-foreground">Tipe Akun</strong> di sidebar.</p>
        <ul className="space-y-1.5">
          <Tip><strong className="text-foreground">Asset</strong> — tabungan, deposito, cash. Saldo bertambah saat income masuk.</Tip>
          <Tip><strong className="text-foreground">Liability</strong> — kartu kredit, pinjaman. Saldo bertambah saat ada pengeluaran.</Tip>
          <Tip>Bisa buat tipe akun custom sesuai kebutuhan</Tip>
        </ul>
      </div>
    ),
  },
  {
    icon: MessageSquare,
    iconBg: "bg-amber-100 dark:bg-amber-950/40",
    iconColor: "text-amber-600 dark:text-amber-400",
    title: "Input Transaksi via AI Prompt",
    content: (
      <div className="space-y-3">
        <p>Ketik transaksi pakai bahasa natural di kolom chat dashboard. AI otomatis memahami jumlah, kategori, dan akun.</p>
        <div className="space-y-1.5">
          <Code>"beli makan siang 35rb dari BCA"</Code>
          <Code>"gaji masuk 8jt ke BNI Debit"</Code>
          <Code>"bayar listrik 250rb cash"</Code>
          <Code>"transfer 1jt dari BCA ke BNI"</Code>
          <Code>"laporan bulan ini"</Code>
        </div>
        <ul className="space-y-1.5">
          <Tip>Tidak perlu format khusus — tulis seperti chat biasa</Tip>
          <Tip>Sebutkan nama akun spesifik agar langsung terhubung ke akun yang benar</Tip>
          <Tip>AI akan konfirmasi interpretasinya sebelum menyimpan</Tip>
        </ul>
      </div>
    ),
  },
  {
    icon: PencilLine,
    iconBg: "bg-sky-100 dark:bg-sky-950/40",
    iconColor: "text-sky-600 dark:text-sky-400",
    title: "Input Manual & Edit Transaksi",
    content: (
      <div className="space-y-3">
        <p>Selain AI prompt, bisa input manual lewat form atau edit transaksi yang sudah ada langsung di tabel.</p>
        <ul className="space-y-1.5">
          <Tip>Klik tombol <strong className="text-foreground">+ Manual</strong> di atas tabel untuk form input manual</Tip>
          <Tip>Hover baris transaksi → klik ikon ✏️ untuk edit inline</Tip>
          <Tip>Bisa ubah tanggal, deskripsi, kategori, akun, dan jumlah</Tip>
          <Tip>Klik ikon 🗑️ untuk hapus transaksi</Tip>
        </ul>
      </div>
    ),
  },
  {
    icon: Target,
    iconBg: "bg-orange-100 dark:bg-orange-950/40",
    iconColor: "text-orange-600 dark:text-orange-400",
    title: "Budget Bulanan",
    content: (
      <div className="space-y-3">
        <p>Set batas pengeluaran per kategori. Pantau di tab <strong className="text-foreground">vs Budget</strong> di dashboard.</p>
        <ul className="space-y-1.5">
          <Tip>Set via prompt: <em>"budget makan 500rb"</em></Tip>
          <Tip>Budget <strong className="text-foreground">Variable</strong> diprorasikan sesuai hari berjalan bulan ini</Tip>
          <Tip>Budget <strong className="text-foreground">Fixed</strong> (kos, arisan, cicilan, dll) tetap 100%</Tip>
          <Tip>Aktifkan <strong className="text-foreground">Rollover</strong> agar sisa budget carry-over ke bulan depan</Tip>
          <Tip>Pengeluaran tanpa budget tampil terpisah di bagian bawah tabel</Tip>
        </ul>
      </div>
    ),
  },
  {
    icon: PiggyBank,
    iconBg: "bg-blue-100 dark:bg-blue-950/40",
    iconColor: "text-blue-600 dark:text-blue-400",
    title: "Goals Tabungan",
    content: (
      <div className="space-y-3">
        <p>Buka <strong className="text-foreground">Tabungan</strong> dari sidebar untuk set dan tracking goals tabungan.</p>
        <ul className="space-y-1.5">
          <Tip>Buat goal dengan nama, target jumlah, dan deadline</Tip>
          <Tip>Progress dihitung otomatis dari transaksi kategori tabungan yang relevan</Tip>
          <Tip>Bisa punya banyak goals sekaligus</Tip>
        </ul>
      </div>
    ),
  },
  {
    icon: CreditCard,
    iconBg: "bg-red-100 dark:bg-red-950/40",
    iconColor: "text-red-600 dark:text-red-400",
    title: "Arus Kas Kartu Kredit",
    content: (
      <div className="space-y-3">
        <p>Buka <strong className="text-foreground">Arus Kas</strong> dari sidebar untuk pantau tagihan kartu kredit per periode billing.</p>
        <ul className="space-y-1.5">
          <Tip>Total pengeluaran, pembayaran, dan outstanding per kartu</Tip>
          <Tip>Periode billing dihitung otomatis berdasarkan tanggal settlement akun</Tip>
          <Tip>Klik tombol transaksi di tiap kartu untuk lihat detail transaksi</Tip>
          <Tip>Notifikasi jika ada kartu yang melewati jatuh tempo</Tip>
        </ul>
      </div>
    ),
  },
  {
    icon: Sparkles,
    iconBg: "bg-pink-100 dark:bg-pink-950/40",
    iconColor: "text-pink-600 dark:text-pink-400",
    title: "AI Analyst",
    content: (
      <div className="space-y-3">
        <p>Buka <strong className="text-foreground">AI Analyst</strong> dari sidebar untuk analisis keuangan mendalam dengan narasi AI.</p>
        <ul className="space-y-1.5">
          <Tip>Pola pengeluaran per kategori dan tren bulanan</Tip>
          <Tip>Deteksi anomali — pengeluaran tidak biasa</Tip>
          <Tip>Rekomendasi spesifik berbasis data transaksi nyata</Tip>
          <Tip>Pilih periode analisis: bulan ini, bulan lalu, atau kustom</Tip>
        </ul>
      </div>
    ),
  },
  {
    icon: FileText,
    iconBg: "bg-teal-100 dark:bg-teal-950/40",
    iconColor: "text-teal-600 dark:text-teal-400",
    title: "Laporan AI via Prompt",
    content: (
      <div className="space-y-3">
        <p>Minta ringkasan keuangan langsung dari kolom chat di dashboard. AI generate narasi otomatis.</p>
        <div className="space-y-1.5">
          <Code>"laporan bulan ini"</Code>
          <Code>"ringkasan keuangan April"</Code>
          <Code>"gimana pengeluaran bulan ini?"</Code>
        </div>
        <ul className="space-y-1.5">
          <Tip>Laporan mencakup total pemasukan, pengeluaran, vs budget</Tip>
          <Tip>Muncul di tab <strong className="text-foreground">Laporan</strong> di dashboard</Tip>
        </ul>
      </div>
    ),
  },
];

export default function PanduanPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
          <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Panduan BudgetIn</h1>
          <p className="text-xs text-muted-foreground">Referensi lengkap semua fitur</p>
        </div>
      </div>

      {/* Intro */}
      <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground leading-relaxed">
        BudgetIn adalah aplikasi manajemen keuangan personal berbasis AI. Catat transaksi lewat chat natural, set budget, pantau kartu kredit, dan dapatkan analisis otomatis dari AI.
      </div>

      {/* Quick start */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Urutan Setup Awal</p>
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          {[
            "Tambah akun (bank, cash, kartu kredit) di Akun & Dompet",
            "Set tipe akun yang sesuai (asset / liability) di Tipe Akun",
            "Mulai catat transaksi via AI prompt atau form manual",
            "Set budget bulanan per kategori",
            "Pantau laporan di tab vs Budget atau AI Analyst",
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="text-sm text-foreground">{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Accordion sections */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Panduan per Fitur</p>
        <div className="space-y-2">
          {sections.map((section) => (
            <Accordion key={section.title} section={section} />
          ))}
        </div>
      </div>
    </div>
  );
}
