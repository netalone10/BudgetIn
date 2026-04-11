import { NextRequest, NextResponse, NextResponse as NR } from "next/server";

// GET /api/record — load riwayat transaksi dari Sheets
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NR.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "bulan ini";

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  if (!user?.sheetsId) return NR.json({ transactions: [] });

  try {
    const accessToken = await getValidToken(session.userId);
    const transactions = await getTransactions(user.sheetsId, accessToken, period);
    // Urutkan terbaru dulu
    transactions.sort((a, b) => (a.date < b.date ? 1 : -1));
    return NR.json({ transactions: transactions.slice(0, 50) });
  } catch {
    return NR.json({ transactions: [] });
  }
}
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { classifyIntent } from "@/utils/groq";
import { getValidToken } from "@/utils/token";
import {
  appendTransaction,
  getTransactions,
  appendBudgetBackup,
} from "@/utils/sheets";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const TIMEZONE = "Asia/Jakarta";

export async function POST(req: NextRequest) {
  // Auth check
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { prompt } = await req.json();
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt kosong" }, { status: 400 });
  }

  // Ambil valid token (auto-refresh kalau perlu)
  let accessToken: string;
  try {
    accessToken = await getValidToken(session.userId);
  } catch {
    return NextResponse.json(
      { error: "Sesi expired. Silakan login ulang." },
      { status: 401 }
    );
  }

  // Ambil sheetsId user
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  if (!user?.sheetsId) {
    return NextResponse.json(
      { error: "Sheets belum siap. Silakan login ulang." },
      { status: 400 }
    );
  }

  // Classify intent via Groq
  let parsed;
  try {
    parsed = await classifyIntent(prompt);
  } catch {
    return NextResponse.json(
      { error: "AI sedang tidak tersedia. Coba lagi." },
      { status: 503 }
    );
  }

  // Debug log — lihat raw Groq output
  if (process.env.NODE_ENV === "development") {
    console.log("[record] parsed:", JSON.stringify(parsed, null, 2));
  }

  // ── TRANSAKSI ─────────────────────────────────────────────────────────────
  if (parsed.intent === "transaksi") {
    const raw = parsed as Record<string, unknown>;
    parsed.amount = parsed.amount ?? Number(raw.nominal ?? raw.harga ?? 0);
    parsed.category = parsed.category ?? raw.kategori as string ?? raw.type as string;

    if (!parsed.amount || !parsed.category) {
      return NextResponse.json({
        intent: "unknown",
        clarification: "Nominal atau kategori tidak terdeteksi. Coba tulis ulang, contoh: 'Makan siang 35rb'",
      });
    }

    try {
      // Simpan ke Sheets
      const transaction = await appendTransaction(user.sheetsId, accessToken, {
        date: parsed.date ?? format(toZonedTime(new Date(), TIMEZONE), "yyyy-MM-dd"),
        amount: parsed.amount,
        category: parsed.category,
        note: parsed.note ?? "",
      });

      // Upsert kategori ke DB
      await prisma.category.upsert({
        where: { userId_name: { userId: session.userId, name: parsed.category } },
        update: {},
        create: { userId: session.userId, name: parsed.category },
      });

      return NextResponse.json({
        intent: "transaksi",
        transaction,
        message: `✓ Dicatat: ${parsed.category} — Rp ${parsed.amount.toLocaleString("id-ID")}`,
      });
    } catch {
      return NextResponse.json(
        { error: "Gagal menyimpan transaksi. Coba lagi." },
        { status: 500 }
      );
    }
  }

  // ── BUDGET SETTING ────────────────────────────────────────────────────────
  if (parsed.intent === "budget_setting") {
    // Comprehensive fallback — Groq kadang pakai berbagai field names
    const raw = parsed as Record<string, unknown>;
    const budgetCategory =
      parsed.budgetCategory ??
      raw.budget_category ??
      raw.category ??
      raw.kategori ??
      raw.budgetKategori;

    const budgetAmount =
      parsed.budgetAmount ??
      raw.budget_amount ??
      raw.amount ??
      raw.nominal ??
      raw.budgetNominal;

    parsed.budgetCategory = budgetCategory as string;
    parsed.budgetAmount = Number(budgetAmount);

    if (!parsed.budgetCategory || !parsed.budgetAmount) {
      return NextResponse.json({
        intent: "unknown",
        clarification: "Kategori atau nominal budget tidak terdeteksi. Contoh: 'Budget makan 500rb'",
      });
    }

    const currentMonth = format(toZonedTime(new Date(), TIMEZONE), "yyyy-MM");

    try {
      // Upsert kategori
      const category = await prisma.category.upsert({
        where: { userId_name: { userId: session.userId, name: parsed.budgetCategory } },
        update: {},
        create: { userId: session.userId, name: parsed.budgetCategory },
      });

      // Upsert budget bulan ini
      await prisma.budget.upsert({
        where: {
          userId_categoryId_month: {
            userId: session.userId,
            categoryId: category.id,
            month: currentMonth,
          },
        },
        update: { amount: parsed.budgetAmount },
        create: {
          userId: session.userId,
          categoryId: category.id,
          amount: parsed.budgetAmount,
          month: currentMonth,
        },
      });

      // Backup ke Sheets
      await appendBudgetBackup(
        user.sheetsId,
        accessToken,
        parsed.budgetCategory,
        parsed.budgetAmount,
        currentMonth
      );

      return NextResponse.json({
        intent: "budget_setting",
        category: parsed.budgetCategory,
        amount: parsed.budgetAmount,
        month: currentMonth,
        message: `✓ Budget ${parsed.budgetCategory} bulan ini: Rp ${parsed.budgetAmount.toLocaleString("id-ID")}`,
      });
    } catch {
      return NextResponse.json(
        { error: "Gagal menyimpan budget. Coba lagi." },
        { status: 500 }
      );
    }
  }

  // ── LAPORAN ───────────────────────────────────────────────────────────────
  if (parsed.intent === "laporan") {
    const period = parsed.period ?? "bulan ini";
    const currentMonth = format(toZonedTime(new Date(), TIMEZONE), "yyyy-MM");

    try {
      // Baca transaksi dari Sheets
      const transactions = await getTransactions(user.sheetsId, accessToken, period);

      // Baca budgets dari DB
      const budgets = await prisma.budget.findMany({
        where: { userId: session.userId, month: currentMonth },
        include: { category: true },
      });

      // Hitung total per kategori
      const spentByCategory: Record<string, number> = {};
      for (const t of transactions) {
        spentByCategory[t.category] = (spentByCategory[t.category] ?? 0) + t.amount;
      }

      const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);

      // Groq generate summary
      const summaryPrompt = `Data pengeluaran user periode "${period}":
Total: Rp ${totalSpent.toLocaleString("id-ID")}
Per kategori: ${JSON.stringify(spentByCategory)}
Budget bulan ini: ${JSON.stringify(budgets.map((b) => ({ kategori: b.category.name, budget: b.amount, terpakai: spentByCategory[b.category.name] ?? 0 })))}

Buat ringkasan singkat (3-5 kalimat) dalam bahasa Indonesia yang informatif dan actionable. Sebutkan kategori terbesar, status budget, dan satu saran.`;

      const summaryRes = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        temperature: 0.3,
        messages: [{ role: "user", content: summaryPrompt }],
      });

      const summary = summaryRes.choices[0]?.message?.content ?? "";

      return NextResponse.json({
        intent: "laporan",
        period,
        totalSpent,
        spentByCategory,
        budgets: budgets.map((b) => ({
          category: b.category.name,
          budget: b.amount,
          spent: spentByCategory[b.category.name] ?? 0,
        })),
        summary,
        transactionCount: transactions.length,
      });
    } catch {
      return NextResponse.json(
        { error: "Gagal memuat data. Coba refresh halaman." },
        { status: 500 }
      );
    }
  }

  // ── UNKNOWN ───────────────────────────────────────────────────────────────
  return NextResponse.json({
    intent: "unknown",
    clarification: parsed.clarification ?? "Maksudnya catat transaksi atau set budget?",
  });
}
