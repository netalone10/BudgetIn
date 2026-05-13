import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/utils/token";
import { getTransactions } from "@/utils/sheets";
import { getTransactionsDB } from "@/utils/db-transactions";
import {
  aggregatePeriodReport,
  aggregateYearlyReport,
  daysBetween,
  formatDateLabelId,
  formatMonthLabelId,
} from "@/lib/report-data";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const YM_RE = /^\d{4}-\d{2}$/;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = new URL(req.url).searchParams;
  const mode = sp.get("mode") ?? "monthly";

  // Resolve period args (period string buat getTransactions + label tampilan)
  let periodArg: string;
  let periodLabel = "";
  let startDate: string | null = null;
  let endDate: string | null = null;
  let yearOut = 0;

  const now = new Date();

  if (mode === "monthly") {
    const month = sp.get("month") || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (!YM_RE.test(month)) {
      return NextResponse.json({ error: "Format bulan harus YYYY-MM." }, { status: 400 });
    }
    periodArg = month;
    periodLabel = formatMonthLabelId(month);
  } else if (mode === "custom") {
    const from = sp.get("from") ?? "";
    const to = sp.get("to") ?? "";
    if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
      return NextResponse.json({ error: "Tanggal from/to tidak valid." }, { status: 400 });
    }
    periodArg = `custom:${from}:${to}`;
    periodLabel = `${formatDateLabelId(from)} – ${formatDateLabelId(to)}`;
    startDate = from;
    endDate = to;
  } else if (mode === "yearly") {
    const year = parseInt(sp.get("year") || String(now.getFullYear()), 10);
    if (!Number.isFinite(year) || year < 1970 || year > 9999) {
      return NextResponse.json({ error: "Tahun tidak valid." }, { status: 400 });
    }
    yearOut = year;
    periodArg = `custom:${year}-01-01:${year}-12-31`;
    periodLabel = `Tahun ${year}`;
  } else {
    return NextResponse.json({ error: "Mode tidak dikenal." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true, name: true, email: true },
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

  try {
    const [transactions, savingsCategoriesRaw] = await Promise.all([
      useSheets
        ? getTransactions(user!.sheetsId!, accessToken, periodArg)
        : getTransactionsDB(session.userId, periodArg),
      prisma.category.findMany({
        where: { userId: session.userId, isSavings: true },
        select: { name: true },
      }),
    ]);

    const savingsCategoryNames = new Set(
      savingsCategoriesRaw.map((c) => c.name.toLowerCase()),
    );

    const ownerName = user?.name || user?.email || "Pengguna";
    const generatedAt = formatDateLabelId(now.toISOString().slice(0, 10));

    const headers = { "Cache-Control": "private, max-age=60, stale-while-revalidate=30" };

    if (mode === "yearly") {
      const { income, expense } = aggregateYearlyReport(transactions, yearOut, savingsCategoryNames);
      return NextResponse.json(
        { year: yearOut, ownerName, generatedAt, income, expense },
        { headers },
      );
    }

    const { income, expense } = aggregatePeriodReport(transactions, savingsCategoryNames);
    const base = { periodLabel, ownerName, generatedAt, income, expense };

    if (mode === "custom" && startDate && endDate) {
      return NextResponse.json(
        { ...base, startDate, endDate, daysInRange: daysBetween(startDate, endDate) },
        { headers },
      );
    }

    return NextResponse.json(base, { headers });
  } catch (error: unknown) {
    console.error("[report endpoint]", error);
    return NextResponse.json({ error: "Gagal memuat laporan." }, { status: 500 });
  }
}
