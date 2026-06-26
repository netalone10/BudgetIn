import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { callWithRotation } from "@/utils/groq";
import { isSavingsTransaction } from "@/lib/savings-utils";
import {
  computeAnalystMetrics,
  computeCashflowScore,
  computeSavingsRates,
} from "@/lib/analyst-metrics";
import { checkRateLimit, RATE_LIMIT_ANALYST } from "@/lib/rate-limit";
import { getFamilyContext } from "@/lib/family";
import {
  getFamilyLedger,
  getFamilyBudgets,
  getFamilySavingsCategoryNames,
  eliminateCrossMemberTransfers,
} from "@/lib/family-data";

const TIMEZONE = "Asia/Jakarta";

// GET /api/family/analyst — analisis AI di level keluarga (bulan ini).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getFamilyContext(session.userId);
  if (!ctx) return NextResponse.json({ family: null });

  const rl = checkRateLimit(`analyst:family:${ctx.family.id}`, RATE_LIMIT_ANALYST);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Terlalu banyak request. Tunggu sebentar." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const currentMonth = format(toZonedTime(new Date(), TIMEZONE), "yyyy-MM");
  const memberIds = ctx.members.map((m) => m.userId);

  const [ledger, savingsNames, budgetData] = await Promise.all([
    getFamilyLedger(session.userId, "bulan ini"),
    getFamilySavingsCategoryNames(memberIds),
    getFamilyBudgets(session.userId, currentMonth),
  ]);

  const transactions = eliminateCrossMemberTransfers(ledger?.transactions ?? []);
  const metrics = computeAnalystMetrics(transactions, savingsNames);
  const { totalIncome, totalSpent, totalSavings, spentByCategory } = metrics;

  if (metrics.expenseTxCount === 0 && totalIncome === 0 && totalSavings === 0) {
    return NextResponse.json({
      family: { id: ctx.family.id, name: ctx.family.name },
      summary: "Belum ada transaksi keluarga bulan ini.",
      healthScore: 100,
      anomalies: [],
      recommendations: ["Mulai catat transaksi untuk mendapatkan analisis keluarga."],
      totalIncome: 0,
      totalSpent: 0,
      totalSavings: 0,
    });
  }

  // Budget context dari budget keluarga (kecuali kategori tabungan).
  const budgetContext = (budgetData?.budgets ?? [])
    .filter((b) => !isSavingsTransaction(b.category, savingsNames))
    .map((b) => ({ category: b.category, budget: b.amount, spent: b.spent }));

  // Health score (deterministik) — sejajar dengan /api/analyst.
  let budgetScore = 25;
  if (budgetContext.length > 0) {
    const scores = budgetContext.map(({ budget, spent }) => {
      if (budget <= 0) return 1;
      const ratio = spent / budget;
      if (ratio <= 1) return 1;
      if (ratio <= 1.2) return 1 - (ratio - 1) / 0.2;
      return 0;
    });
    budgetScore = Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 50);
  }
  const cashflowScore = computeCashflowScore({ totalIncome, totalSpent, totalSavings });
  const healthScore = budgetScore + cashflowScore;

  const overBudget = budgetContext
    .filter((b) => b.budget > 0 && b.spent > b.budget)
    .map((b) => ({
      category: b.category,
      budget: b.budget,
      spent: b.spent,
      overBy: b.spent - b.budget,
      overPct: Math.round(((b.spent - b.budget) / b.budget) * 100),
    }));

  const { allocatedSavingsRate, netSurplusRate } = computeSavingsRates({ totalIncome, totalSpent, totalSavings });

  const topCategories = Object.entries(spentByCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([cat, amt]) => `- ${cat}: Rp ${amt.toLocaleString("id-ID")} (${totalSpent > 0 ? ((amt / totalSpent) * 100).toFixed(1) : 0}%)`)
    .join("\n");

  const anomaliText = overBudget.length > 0
    ? overBudget.map((o) => `${o.category}: budget Rp ${o.budget.toLocaleString("id-ID")}, realisasi Rp ${o.spent.toLocaleString("id-ID")}, lebih ${o.overPct}%`).join("\n")
    : "Tidak ada kategori yang melebihi budget keluarga.";

  const systemPrompt = `Kamu AI Financial Analyst untuk sebuah KELUARGA (gabungan beberapa anggota). Semua angka sudah disiapkan — JANGAN ubah/karang angka.
- TABUNGAN bukan pengeluaran; naiknya tabungan = sinyal positif.
- Bicara di level "keluarga" (mis. "pengeluaran keluarga"), bukan individu.
Kembalikan HANYA JSON valid:
{ "summary": "2-3 kalimat kondisi cashflow keluarga + 1-2 kategori terbesar", "anomalies": ["1 kalimat per item over-budget; [] jika kosong"], "recommendations": ["3 saran spesifik menyebut kategori/angka nyata"] }`;

  const userPrompt = `PERIODE: bulan ini (keluarga ${ctx.family.name})
PEMASUKAN: Rp ${totalIncome.toLocaleString("id-ID")}
PENGELUARAN (di luar tabungan): Rp ${totalSpent.toLocaleString("id-ID")}
TABUNGAN: Rp ${totalSavings.toLocaleString("id-ID")}
SURPLUS: Rp ${(totalIncome - totalSpent).toLocaleString("id-ID")} → ${totalIncome >= totalSpent ? "SURPLUS" : "DEFISIT"}
ALOKASI TABUNGAN: ${totalIncome > 0 ? allocatedSavingsRate.toFixed(1) + "%" : "n/a"}

5 KATEGORI PENGELUARAN TERBESAR:
${topCategories || "(belum ada)"}

ANOMALI OVER-BUDGET:
${anomaliText}`;

  let narrative: { summary?: string; anomalies?: string[]; recommendations?: string[] } = {};
  let aiUnavailable = false;
  try {
    const res = await callWithRotation((client) =>
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
    narrative = JSON.parse(res.choices[0]?.message?.content ?? "{}");
  } catch (err) {
    console.error("[family/analyst] AI narrative gagal — fallback deterministik:", err);
    aiUnavailable = true;
  }

  return NextResponse.json({
    family: { id: ctx.family.id, name: ctx.family.name },
    summary: narrative.summary ?? "",
    aiUnavailable,
    healthScore,
    anomalies: narrative.anomalies ?? overBudget.map((o) => `${o.category} melebihi budget ${o.overPct}%`),
    recommendations: narrative.recommendations ?? [],
    netSurplusRate,
    allocatedSavingsRate,
    totalIncome,
    totalSpent,
    totalSavings,
  });
}
