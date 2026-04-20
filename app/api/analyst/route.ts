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
    const transactions = useSheets
      ? await getTransactions(user!.sheetsId!, accessToken, period)
      : await getTransactionsDB(session.userId, period);

    const budgets = await prisma.budget.findMany({
      where: { userId: session.userId, month: currentMonth },
      include: { category: true },
    });

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

    // ── AI: hanya narasi, skor sudah dihitung ─────────────────────────────────

    const systemPrompt = `Kamu adalah AI Financial Analyst. Tugasmu menulis narasi analisis keuangan berdasarkan data yang sudah disiapkan.
Kembalikan HANYA JSON valid tanpa backtick atau markdown, dengan skema persis:
{
  "summary": "String (2-3 kalimat ringkasan kondisi keuangan bulan ini)",
  "anomalies": ["Array string — peringatan pengeluaran over budget atau pola aneh. Kosong jika tidak ada."],
  "recommendations": ["Array string — TEPAT 3 saran konkret dan actionable untuk memperbaiki keuangan"]
}
Gunakan bahasa Indonesia yang mudah dipahami. JANGAN tambahkan field selain yang diminta.`;

    const userPrompt = `Periode: "${period}"
Health Score: ${healthScore}/100 (Budget Score: ${budgetScore}/50, Cashflow Score: ${cashflowScore}/50)
Total Pengeluaran: Rp ${totalSpent.toLocaleString("id-ID")}
Total Pemasukan: Rp ${totalIncome.toLocaleString("id-ID")}
Selisih: Rp ${(totalIncome - totalSpent).toLocaleString("id-ID")} (${totalIncome > 0 ? ((1 - totalSpent / totalIncome) * 100).toFixed(1) : "N/A"}% savings rate)
Pengeluaran per Kategori: ${JSON.stringify(spentByCategory)}
Budget vs Realisasi: ${JSON.stringify(budgetContext)}`;

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
    });

  } catch (error: unknown) {
    console.error("[analyst endpoint]", error);
    return NextResponse.json({ error: "Gagal memproses analisis." }, { status: 500 });
  }
}
