import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callWithRotation } from "@/utils/groq";
import { getValidToken } from "@/utils/token";
import { getTransactions } from "@/utils/sheets";
import { getTransactionsDB } from "@/utils/db-transactions";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { isSavingsTransaction } from "@/lib/savings-utils";
import {
  computeAnalystMetrics,
  computeCashflowScore,
  computeSavingsRates,
} from "@/lib/analyst-metrics";
import { checkRateLimit, RATE_LIMIT_ANALYST } from "@/lib/rate-limit";

const TIMEZONE = "Asia/Jakarta";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting — analyst adalah query berat yang memanggil Groq
  const rl = checkRateLimit(`analyst:${session.userId}`, RATE_LIMIT_ANALYST);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Terlalu banyak request. Tunggu sebentar sebelum mencoba lagi." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": String(RATE_LIMIT_ANALYST.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
        },
      }
    );
  }

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "bulan ini";

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  const useSheets = !!user?.sheetsId;
  let accessToken = "";
  if (useSheets) {
    try {
      accessToken = await getValidToken(session.userId);
    } catch {
      return NextResponse.json({ error: "Sesi expired. Silakan login ulang." }, { status: 401 });
    }
  }

  const currentMonth = format(toZonedTime(new Date(), TIMEZONE), "yyyy-MM");

  try {
    const [transactions, budgets, savingsCategoriesRaw] = await Promise.all([
      useSheets
        ? getTransactions(user!.sheetsId!, accessToken, period)
        : getTransactionsDB(session.userId, period),
      prisma.budget.findMany({
        where: { userId: session.userId, month: currentMonth },
        include: { category: { select: { name: true } } },
      }),
      prisma.category.findMany({
        where: { userId: session.userId, isSavings: true },
        select: { name: true },
      }),
    ]);

    const savingsCategoryNames = new Set(
      savingsCategoriesRaw.map((c) => c.name.toLowerCase())
    );

    const metrics = computeAnalystMetrics(transactions, savingsCategoryNames);
    const { totalIncome, totalSpent, totalSavings, spentByCategory, expenseTxs: rawExpenseTxs, uniqueExpenseDays } = metrics;

    if (metrics.expenseTxCount === 0 && totalIncome === 0 && totalSavings === 0) {
      return NextResponse.json({
        summary: "Belum ada transaksi bulan ini.",
        healthScore: 100,
        anomalies: [],
        recommendations: ["Catat pengeluaran pertama Anda untuk mendapatkan pantauan cerdas."],
        savingsRate: 0,
        allocatedSavingsRate: 0,
        netSurplusRate: 0,
        totalIncome: 0,
        totalSpent: 0,
        totalSavings: 0,
        categoryPercentages: {},
        topExpenses: [],
        dailyAvgSpending: 0,
        fmRecommendations: [],
      });
    }

    // Budget context — kategori tabungan dipisahkan supaya tidak diflag sebagai over-budget expense.
    // (Tabungan punya sasaran/target sendiri di /dashboard/savings, bukan ranah analyst expense.)
    const budgetContext = budgets
      .filter((b) => !isSavingsTransaction(b.category.name, savingsCategoryNames))
      .map((b) => ({
        category: b.category.name,
        budget: Number(b.amount),
        spent: spentByCategory[b.category.name] ?? 0,
      }));

    // ── Health Score — dihitung deterministik, bukan oleh AI ──────────────────

    // Budget Score (0–50)
    let budgetScore = 25; // netral kalau tidak ada budget
    if (budgetContext.length > 0) {
      const categoryScores = budgetContext.map(({ budget, spent }) => {
        if (budget <= 0) return 1;
        const ratio = spent / budget;
        if (ratio <= 1) return 1;
        if (ratio <= 1.2) return 1 - (ratio - 1) / 0.2; // linear 1→0
        return 0;
      });
      const avg = categoryScores.reduce((s, v) => s + v, 0) / categoryScores.length;
      budgetScore = Math.round(avg * 50);
    }

    // Cashflow Score (0–50): basis expense ratio + bonus alokasi tabungan ≥10%.
    const cashflowScore = computeCashflowScore({ totalIncome, totalSpent, totalSavings });

    const healthScore = budgetScore + cashflowScore;

    // ── Anomali — dihitung server-side, AI hanya tulis deskripsi ─────────────
    const overBudget = budgetContext
      .filter((b) => b.budget > 0 && b.spent > b.budget)
      .map((b) => ({
        category: b.category,
        budget: b.budget,
        spent: b.spent,
        overBy: b.spent - b.budget,
        overPct: Math.round(((b.spent - b.budget) / b.budget) * 100),
      }));

    const { allocatedSavingsRate, netSurplusRate } = computeSavingsRates({
      totalIncome,
      totalSpent,
      totalSavings,
    });

    // ── Finance-manager: category %, top expenses, daily avg, rule-based recs ─
    const categoryPercentages: Record<string, number> = {};
    for (const [cat, amt] of Object.entries(spentByCategory)) {
      categoryPercentages[cat] = totalSpent > 0 ? Math.round((amt / totalSpent) * 1000) / 10 : 0;
    }

    const expenseTxs = [...rawExpenseTxs]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((t) => ({
        date: t.date,
        description: t.note || t.category,
        category: t.category,
        amount: t.amount,
      }));

    const dailyAvgSpending = uniqueExpenseDays > 0
      ? Math.round(totalSpent / uniqueExpenseDays)
      : 0;

    const fmRecommendations: string[] = [];
    if (totalIncome <= 0) {
      // tidak ada income → skip rekomendasi tabungan
    } else if (allocatedSavingsRate <= 0) {
      fmRecommendations.push(
        "💡 Belum ada alokasi tabungan eksplisit bulan ini. Sisihkan minimal 10% dari pemasukan ke tabungan/investasi."
      );
    } else if (allocatedSavingsRate < 10) {
      fmRecommendations.push(
        `⚠️ Alokasi tabungan baru ${allocatedSavingsRate.toFixed(1)}% — naikkan ke minimal 10% untuk fondasi finansial yang aman.`
      );
    } else if (allocatedSavingsRate < 20) {
      fmRecommendations.push(
        `💡 Alokasi tabungan ${allocatedSavingsRate.toFixed(1)}% — sudah baik, target ke 20% untuk percepatan kekayaan.`
      );
    } else {
      fmRecommendations.push(
        `✅ Alokasi tabungan ${allocatedSavingsRate.toFixed(1)}% — sangat baik! Pertahankan tren positif ini.`
      );
    }
    for (const [cat, amt] of Object.entries(spentByCategory)) {
      const pct = totalSpent > 0 ? (amt / totalSpent) * 100 : 0;
      const lc = cat.toLowerCase();
      if ((lc.includes("makan") || lc.includes("food") || lc.includes("restoran")) && pct > 15) {
        fmRecommendations.push(`🍽️ Pengeluaran "${cat}" ${pct.toFixed(1)}% dari total — pertimbangkan meal planning.`);
      } else if ((lc.includes("belanja") || lc.includes("shopping")) && pct > 10) {
        fmRecommendations.push(`🛍️ "${cat}" ${pct.toFixed(1)}% dari total — review pembelian yang tidak perlu.`);
      } else if (lc.includes("transport") && pct > 15) {
        fmRecommendations.push(`🚗 "${cat}" ${pct.toFixed(1)}% dari total — cari opsi transportasi lebih hemat.`);
      }
    }

    // ── AI: hanya narasi, skor + anomali sudah dihitung ──────────────────────

    const systemPrompt = `Kamu adalah AI Financial Analyst yang berbicara langsung dan jujur. Semua angka sudah disiapkan — JANGAN ubah atau karang angka sendiri.

PENTING — Konsep akuntansi tabungan:
- TABUNGAN/INVESTASI adalah pengurang kas yang menambah aset (mirip withdrawal/prive ke equity), BUKAN pengeluaran.
- Naiknya tabungan = SINYAL POSITIF (kekayaan bersih bertambah). Semakin tinggi alokasi tabungan, semakin baik.
- DILARANG menyarankan untuk "mengurangi tabungan" atau menyebut tabungan sebagai pengeluaran.
- Field PENGELUARAN sudah TIDAK termasuk tabungan.

Kembalikan HANYA JSON valid tanpa backtick atau markdown:
{
  "summary": "2-3 kalimat. Sebut kondisi cashflow nyata (surplus/defisit), sebutkan 1-2 kategori pengeluaran terbesar berdasarkan data. Bila ada alokasi tabungan, apresiasi sebagai sinyal positif.",
  "anomalies": ["1 kalimat per item over-budget dari daftar ANOMALI. Jika kosong, kembalikan []."],
  "recommendations": ["Saran spesifik 1", "Saran spesifik 2", "Saran spesifik 3"]
}

ATURAN recommendations — WAJIB DIIKUTI:
- Setiap saran HARUS menyebut nama kategori atau angka nyata dari data yang diberikan
- Saran harus ACTIONABLE: kata kerja konkret (kurangi, alokasikan, batasi, pindahkan, evaluasi)
- DILARANG saran generik seperti "pantau pengeluaran", "perbaiki budget", "tingkatkan kesejahteraan"
- DILARANG menyebut health score
- DILARANG menyarankan mengurangi tabungan/investasi
- Jika ada anomali over-budget: 1 saran harus address kategori tersebut
- Jika alokasi tabungan < 10% dari pemasukan: 1 saran harus sebut nominal yang bisa dialokasikan ke tabungan
- Bahasa Indonesia natural, tidak kaku`;

    const anomaliText = overBudget.length > 0
      ? overBudget.map((o) =>
          `${o.category}: budget Rp ${o.budget.toLocaleString("id-ID")}, realisasi Rp ${o.spent.toLocaleString("id-ID")}, lebih Rp ${o.overBy.toLocaleString("id-ID")} (${o.overPct}%)`
        ).join("\n")
      : "Tidak ada kategori yang melebihi budget.";

    const topCategories = Object.entries(spentByCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([cat, amt]) => `- ${cat}: Rp ${amt.toLocaleString("id-ID")} (${totalSpent > 0 ? ((amt / totalSpent) * 100).toFixed(1) : 0}% dari total)`)
      .join("\n");

    const allocatedRateLabel = totalIncome > 0
      ? `${allocatedSavingsRate.toFixed(1)}% (${allocatedSavingsRate >= 20 ? "sangat baik" : allocatedSavingsRate >= 10 ? "baik" : allocatedSavingsRate > 0 ? "perlu ditingkatkan" : "belum ada alokasi"})`
      : "tidak bisa dihitung (tidak ada pemasukan)";
    const netSurplusLabel = totalIncome > 0
      ? `${netSurplusRate.toFixed(1)}%`
      : "tidak bisa dihitung";

    const userPrompt = `PERIODE: ${period}
PEMASUKAN: Rp ${totalIncome.toLocaleString("id-ID")}
PENGELUARAN (di luar tabungan): Rp ${totalSpent.toLocaleString("id-ID")}
TABUNGAN (alokasi eksplisit, positif): Rp ${totalSavings.toLocaleString("id-ID")}
SURPLUS BERSIH: Rp ${(totalIncome - totalSpent).toLocaleString("id-ID")} → ${totalIncome > totalSpent ? "SURPLUS" : "DEFISIT"}
ALOKASI TABUNGAN / PEMASUKAN: ${allocatedRateLabel}
NET SURPLUS / PEMASUKAN: ${netSurplusLabel}

5 KATEGORI PENGELUARAN TERBESAR (tabungan TIDAK termasuk):
${topCategories || "(belum ada pengeluaran non-tabungan)"}

ANOMALI OVER-BUDGET (hanya ini yang boleh masuk field anomalies):
${anomaliText}`;

    const summaryRes = await callWithRotation((client) =>
      client.chat.completions.create({
        model: "llama-3.1-8b-instant",
        response_format: { type: "json_object" },
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      })
    );

    const jsonString = summaryRes.choices[0]?.message?.content ?? "{}";
    const narrative = JSON.parse(jsonString);

    return NextResponse.json({
      summary: narrative.summary ?? "",
      healthScore,
      anomalies: narrative.anomalies ?? [],
      recommendations: narrative.recommendations ?? [],
      // savingsRate dipertahankan sebagai alias netSurplusRate untuk back-compat consumer existing.
      savingsRate: netSurplusRate,
      allocatedSavingsRate,
      netSurplusRate,
      totalIncome,
      totalSpent,
      totalSavings,
      categoryPercentages,
      topExpenses: expenseTxs,
      dailyAvgSpending,
      fmRecommendations,
    }, { headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=60" } });

  } catch (error: unknown) {
    console.error("[analyst endpoint]", error);
    return NextResponse.json({ error: "Gagal memproses analisis." }, { status: 500 });
  }
}
