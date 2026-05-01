import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTransactionsDB } from "@/utils/db-transactions";
import { getTransactions } from "@/utils/sheets";
import { getValidToken } from "@/utils/token";
import { callWithRotation } from "@/utils/groq";
import { isExpenseTransaction } from "@/lib/transaction-classification";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const TIMEZONE = "Asia/Jakarta";

export interface PredictionResult {
  predictions: { category: string; history: number[]; predicted: number; trend: "up" | "down" | "stable" }[];
  totalPredicted: number;
  basedOnMonths: string[];
  insight: string;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = toZonedTime(new Date(), TIMEZONE);

  // 3 bulan terakhir (bukan bulan ini)
  const months = [3, 2, 1].map((n) => {
    const d = subMonths(now, n);
    return {
      label: format(d, "yyyy-MM"),
      from: format(startOfMonth(d), "yyyy-MM-dd"),
      to: format(endOfMonth(d), "yyyy-MM-dd"),
    };
  });

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

  // Fetch transaksi per bulan
  const monthlyData: { label: string; byCategory: Record<string, number> }[] = [];

  for (const month of months) {
    const period = `custom:${month.from}:${month.to}`;
    const transactions = useSheets
      ? await getTransactions(user!.sheetsId!, accessToken, period).catch(() => [])
      : await getTransactionsDB(session.userId, period).catch(() => []);

    const byCategory: Record<string, number> = {};
    for (const t of transactions) {
      if (isExpenseTransaction(t)) {
        byCategory[t.category] = (byCategory[t.category] ?? 0) + t.amount;
      }
    }
    monthlyData.push({ label: month.label, byCategory });
  }

  // Kumpulkan semua kategori dari 3 bulan
  const allCategories = new Set<string>();
  for (const m of monthlyData) {
    for (const cat of Object.keys(m.byCategory)) allCategories.add(cat);
  }

  if (allCategories.size === 0) {
    return NextResponse.json(
      { error: "Belum ada data pengeluaran 3 bulan terakhir untuk diprediksi." },
      { status: 400 }
    );
  }

  // History per kategori: [bulan-3, bulan-2, bulan-1]
  const historyByCat: Record<string, number[]> = {};
  for (const cat of allCategories) {
    historyByCat[cat] = monthlyData.map((m) => m.byCategory[cat] ?? 0);
  }

  // Sort by total descending untuk prompt yang bersih
  const sortedCats = [...allCategories].sort(
    (a, b) => historyByCat[b].reduce((s, v) => s + v, 0) - historyByCat[a].reduce((s, v) => s + v, 0)
  );

  const dataStr = sortedCats
    .map((cat) => `${cat}: ${historyByCat[cat].map((v) => `Rp ${v.toLocaleString("id-ID")}`).join(" → ")}`)
    .join("\n");

  const predictionPrompt = `Kamu adalah analis keuangan. Data pengeluaran per kategori selama 3 bulan terakhir (${months.map((m) => m.label).join(", ")}):

${dataStr}

Prediksi pengeluaran bulan depan per kategori berdasarkan tren. Tentukan tren: "up" (naik), "down" (turun), atau "stable" (stabil).

Balas HANYA dengan JSON valid tanpa markdown:
{"predictions":[{"category":"STRING","predicted":NUMBER,"trend":"up"|"down"|"stable"}],"insight":"1-2 kalimat ringkasan dalam Bahasa Indonesia"}`;

  const completion = await callWithRotation((client) =>
    client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: predictionPrompt }],
    })
  ).catch(() => null);

  if (!completion) {
    return NextResponse.json({ error: "AI tidak tersedia. Coba lagi." }, { status: 503 });
  }

  let groqResult: { predictions: { category: string; predicted: number; trend: string }[]; insight: string };
  try {
    groqResult = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
  } catch {
    return NextResponse.json({ error: "Gagal memproses prediksi." }, { status: 500 });
  }

  const enriched = (groqResult.predictions ?? [])
    .map((p) => ({
      category: p.category,
      history: historyByCat[p.category] ?? [0, 0, 0],
      predicted: p.predicted,
      trend: (p.trend ?? "stable") as "up" | "down" | "stable",
    }))
    .sort((a, b) => b.predicted - a.predicted);

  return NextResponse.json({
    predictions: enriched,
    totalPredicted: enriched.reduce((s, p) => s + p.predicted, 0),
    basedOnMonths: months.map((m) => m.label),
    insight: groqResult.insight ?? "",
  } satisfies PredictionResult);
}
