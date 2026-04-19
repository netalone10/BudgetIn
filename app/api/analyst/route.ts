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
      if (t.type === "income") {
        totalIncome += t.amount;
      } else {
        spentByCategory[t.category] = (spentByCategory[t.category] ?? 0) + t.amount;
      }
    }
    
    const totalSpent = Object.values(spentByCategory).reduce((s, v) => s + v, 0);

    // Basic heuristic to not waste AI resources if there's no data
    if (transactions.length === 0) {
      return NextResponse.json({
        summary: "Belum ada transaksi bulan ini.",
        healthScore: 100,
        anomalies: [],
        recommendations: ["Catat pengeluaran pertama Anda untuk mendapatkan pantauan cerdas."]
      });
    }

    const budgetContext = budgets.map((b) => ({ 
      category: b.category.name, 
      budget: b.amount, 
      spent: spentByCategory[b.category.name] ?? 0 
    }));

    const systemPrompt = `You are an elite AI Financial Analyst. You analyze user finances based on their transactions and budgets.
Return your response STRICTLY as a valid JSON object without any backticks, markdown, or explanation, adhering exactly to this schema:
{
  "summary": "String (A 2-3 sentence overview of the month's finances)",
  "healthScore": "Number (0-100 indicating financial health, above 80 is excellent, below 50 means overbudget problems)",
  "anomalies": ["Array of Strings (Alerts about overspending or weird spending patterns. Leave empty if none)"],
  "recommendations": ["Array of Strings (EXACTLY 3 clear, actionable advice points to improve saving)"]
}
Keep the language in easy-to-understand Indonesian.`;

    const userPrompt = `Data Pengeluaran "${period}":
Total Keluar: Rp ${totalSpent.toLocaleString("id-ID")}
Total Masuk Pemasukan: Rp ${totalIncome.toLocaleString("id-ID")}
Rincian per Kategori: ${JSON.stringify(spentByCategory)}
Target Budget Bulan Ini: ${JSON.stringify(budgetContext)}`;

    const summaryRes = await callWithRotation((client) =>
      client.chat.completions.create({
        model: "llama-3.1-8b-instant",
        response_format: { type: "json_object" },
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
      })
    );

    const jsonFormatString = summaryRes.choices[0]?.message?.content ?? "{}";
    const reportData = JSON.parse(jsonFormatString);

    return NextResponse.json(reportData);

  } catch (error: unknown) {
    console.error("[analyst endpoint]", error);
    return NextResponse.json({ error: "Gagal memproses analisis." }, { status: 500 });
  }
}
