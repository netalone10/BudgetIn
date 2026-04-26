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

const TIMEZONE = "Asia/Jakarta";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const [transactions, budgets] = await Promise.all([
      useSheets
        ? getTransactions(user!.sheetsId!, accessToken, period)
        : getTransactionsDB(session.userId, period),
      prisma.budget.findMany({
        where: { userId: session.userId, month: currentMonth },
        include: { category: true },
      }),
    ]);

    const spentByCategory: Record<string, number> = {};
    let totalIncome = 0;

    for (const t of transactions) {
      // Saldo Awal tidak masuk income maupun expense
      if (t.category === "Saldo Awal") continue;
      if (t.type === "income") {
        totalIncome += t.amount;
      } else {
        spentByCategory[t.category] = (spentByCategory[t.category] ?? 0) + t.amount;
      }
    }

    const totalSpent = Object.values(spentByCategory).reduce((s, v) => s + v, 0);

    if (transactions.filter((t) => t.category !== "Saldo Awal").length === 0) {
      return NextResponse.json({
        summary: "Belum ada transaksi bulan ini.",
        healthScore: 100,
        anomalies: [],
        recommendations: ["Catat pengeluaran pertama Anda untuk mendapatkan pantauan cerdas."],
        savingsRate: 0,
        totalIncome: 0,
        totalSpent: 0,
        categoryPercentages: {},
        topExpenses: [],
        dailyAvgSpending: 0,
        fmRecommendations: [],
      });
    }

    const budgetContext = budgets.map((b) => ({
      category: b.category.name,
      budget: b.amount,
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

    // Cashflow Score (0–50)
    let cashflowScore = 25; // netral kalau income = 0
    if (totalIncome > 0) {
      const ratio = totalSpent / totalIncome;
      if (ratio <= 0.7) cashflowScore = 50;
      else if (ratio <= 0.8) cashflowScore = 40;
      else if (ratio <= 0.9) cashflowScore = 30;
      else if (ratio <= 1.0) cashflowScore = 20;
      else if (ratio <= 1.2) cashflowScore = 10;
      else cashflowScore = 0;
    }

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

    const savingsRateNum = totalIncome > 0 ? (1 - totalSpent / totalIncome) * 100 : 0;
    const savingsRate = totalIncome > 0 ? savingsRateNum.toFixed(1) : null;

    // ── Finance-manager: category %, top expenses, daily avg, rule-based recs ─
    const categoryPercentages: Record<string, number> = {};
    for (const [cat, amt] of Object.entries(spentByCategory)) {
      categoryPercentages[cat] = totalSpent > 0 ? Math.round((amt / totalSpent) * 1000) / 10 : 0;
    }

    const expenseTxs = transactions
      .filter((t) => t.type === "expense" && t.category !== "Saldo Awal")
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((t) => ({
        date: t.date,
        description: (t as { note?: string }).note || t.category,
        category: t.category,
        amount: t.amount,
      }));

    const txDates = transactions
      .filter((t) => t.type === "expense")
      .map((t) => t.date.slice(0, 10));
    const uniqueDays = new Set(txDates).size || 1;
    const dailyAvgSpending = Math.round(totalSpent / uniqueDays);

    const fmRecommendations: string[] = [];
    if (savingsRateNum < 10) {
      fmRecommendations.push("⚠️ Savings rate di bawah 10% — kurangi pengeluaran diskresioner segera.");
    } else if (savingsRateNum < 20) {
      fmRecommendations.push("💡 Savings rate masih bisa ditingkatkan ke 20% untuk keamanan finansial lebih baik.");
    } else {
      fmRecommendations.push("✅ Savings rate sangat baik! Pertahankan tren positif ini.");
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

Kembalikan HANYA JSON valid tanpa backtick atau markdown:
{
  "summary": "2-3 kalimat. Sebut kondisi cashflow nyata (surplus/defisit), sebutkan 1-2 kategori pengeluaran terbesar berdasarkan data.",
  "anomalies": ["1 kalimat per item over-budget dari daftar ANOMALI. Jika kosong, kembalikan []."],
  "recommendations": ["Saran spesifik 1", "Saran spesifik 2", "Saran spesifik 3"]
}

ATURAN recommendations — WAJIB DIIKUTI:
- Setiap saran HARUS menyebut nama kategori atau angka nyata dari data yang diberikan
- Saran harus ACTIONABLE: kata kerja konkret (kurangi, alokasikan, batasi, pindahkan, evaluasi)
- DILARANG saran generik seperti "pantau pengeluaran", "perbaiki budget", "tingkatkan kesejahteraan"
- DILARANG menyebut health score
- Jika ada anomali over-budget: 1 saran harus address kategori tersebut
- Jika savings rate rendah (<20%): 1 saran harus sebut nominal yang bisa dipotong
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

    const userPrompt = `PERIODE: ${period}
PEMASUKAN: Rp ${totalIncome.toLocaleString("id-ID")}
PENGELUARAN: Rp ${totalSpent.toLocaleString("id-ID")}
SELISIH: Rp ${(totalIncome - totalSpent).toLocaleString("id-ID")} → ${totalIncome > totalSpent ? "SURPLUS" : "DEFISIT"}
SAVINGS RATE: ${savingsRate ? `${savingsRate}% (${Number(savingsRate) >= 20 ? "baik" : Number(savingsRate) >= 10 ? "perlu ditingkatkan" : "kritis — di bawah 10%"})` : "tidak bisa dihitung (tidak ada data pemasukan)"}

5 KATEGORI PENGELUARAN TERBESAR:
${topCategories}

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
      savingsRate: savingsRateNum,
      totalIncome,
      totalSpent,
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
