import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/utils/token";
import { getTransactions } from "@/utils/sheets";
import { getTransactionsDB } from "@/utils/db-transactions";
import { getAccountBalancesAsOf } from "@/utils/account-balance";
import { getFullSheetsLedger } from "@/lib/sheets-data";
import { computeAccountBalancesFromTx } from "@/utils/sheets-ledger";
import {
  aggregatePeriodReport,
  aggregateYearlyReport,
  aggregateOwnerEquity,
  buildBalanceSheet,
  daysBetween,
  formatDateLabelId,
  formatMonthLabelId,
  type BalanceSheetAccount,
} from "@/lib/report-data";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const YM_RE = /^\d{4}-\d{2}$/;

const HEADERS = { "Cache-Control": "private, max-age=60, stale-while-revalidate=30" };

/** Tanggal hari ini "YYYY-MM-DD" (waktu lokal server, sejalan dgn default mode lain). */
function todayISO(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Hari terakhir bulan "YYYY-MM" sebagai "YYYY-MM-DD". */
function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${ym}-${String(last).padStart(2, "0")}`;
}

/** Tanggal sehari sebelum `iso` ("YYYY-MM-DD"). */
function prevDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface BalanceCtx {
  useSheets: boolean;
  userId: string;
  sheetsId: string | null;
}

/** Saldo per akun (name/classification/balance) per tanggal — reuse fungsi saldo existing. */
async function balanceAccountsAsOf(ctx: BalanceCtx, asOf?: string): Promise<BalanceSheetAccount[]> {
  if (ctx.useSheets && ctx.sheetsId) {
    const ledger = await getFullSheetsLedger(ctx.userId, ctx.sheetsId);
    const txns = asOf ? ledger.transactions.filter((t) => t.date <= asOf) : ledger.transactions;
    const balances = computeAccountBalancesFromTx(
      ledger.accounts,
      txns.map((t) => ({
        type: t.type as "income" | "expense",
        amount: Number(t.amount) || 0,
        fromAccountId: t.fromAccountId,
        toAccountId: t.toAccountId,
      })),
    );
    // Sheets tak punya sortOrder eksplisit → pakai urutan kemunculan tipe
    // sebagai proxy likuiditas (urutan baris di sheet Akun).
    const typeOrder = new Map<string, number>();
    return ledger.accounts.map((a) => {
      if (!typeOrder.has(a.type)) typeOrder.set(a.type, typeOrder.size);
      return {
        name: a.name,
        classification: a.classification,
        balance: balances.get(a.id) ?? 0,
        typeName: a.type,
        typeOrder: typeOrder.get(a.type),
      };
    });
  }

  const accs = await getAccountBalancesAsOf(ctx.userId, asOf);
  return accs.map((a) => ({
    name: a.name,
    classification: a.accountType.classification,
    balance: a.currentBalance.toNumber(),
    typeName: a.accountType.name,
    typeOrder: a.accountType.sortOrder,
  }));
}

/** Kekayaan bersih (ekuitas) per tanggal = total aset − total liabilitas. */
async function netWorthAsOf(ctx: BalanceCtx, asOf?: string): Promise<number> {
  const accounts = await balanceAccountsAsOf(ctx, asOf);
  return buildBalanceSheet(accounts).equity;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = new URL(req.url).searchParams;
  const mode = sp.get("mode") ?? "monthly";
  const now = new Date();

  if (!["monthly", "custom", "yearly", "equity", "balance"].includes(mode)) {
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

  const ownerName = user?.name || user?.email || "Pengguna";
  const generatedAt = formatDateLabelId(todayISO(now));
  const ctx: BalanceCtx = { useSheets, userId: session.userId, sheetsId: user?.sheetsId ?? null };

  try {
    // ── Balance Sheet (Neraca) — snapshot per tanggal ─────────────────────────
    if (mode === "balance") {
      const asOf = sp.get("asOf") || todayISO(now);
      if (!DATE_RE.test(asOf)) {
        return NextResponse.json({ error: "Tanggal asOf harus YYYY-MM-DD." }, { status: 400 });
      }
      const accounts = await balanceAccountsAsOf(ctx, asOf);
      const bs = buildBalanceSheet(accounts);
      return NextResponse.json(
        { asOf, asOfLabel: formatDateLabelId(asOf), ownerName, generatedAt, ...bs },
        { headers: HEADERS },
      );
    }

    // ── Resolve periode untuk income statement & owner's equity ───────────────
    let periodArg: string;
    let periodLabel = "";
    let startDate: string | null = null;
    let endDate: string | null = null;
    let yearOut = 0;

    const isYearly = mode === "yearly";
    if (mode === "monthly" || mode === "equity") {
      // equity & monthly: dukung ?month= atau ?from=&to=
      const from = sp.get("from");
      const to = sp.get("to");
      if (from && to) {
        if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
          return NextResponse.json({ error: "Tanggal from/to tidak valid." }, { status: 400 });
        }
        periodArg = `custom:${from}:${to}`;
        periodLabel = `${formatDateLabelId(from)} – ${formatDateLabelId(to)}`;
        startDate = from;
        endDate = to;
      } else {
        const month = sp.get("month") || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        if (!YM_RE.test(month)) {
          return NextResponse.json({ error: "Format bulan harus YYYY-MM." }, { status: 400 });
        }
        periodArg = month;
        periodLabel = formatMonthLabelId(month);
        startDate = `${month}-01`;
        endDate = lastDayOfMonth(month);
      }
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
    } else {
      const year = parseInt(sp.get("year") || String(now.getFullYear()), 10);
      if (!Number.isFinite(year) || year < 1970 || year > 9999) {
        return NextResponse.json({ error: "Tahun tidak valid." }, { status: 400 });
      }
      yearOut = year;
      periodArg = `custom:${year}-01-01:${year}-12-31`;
      periodLabel = `Tahun ${year}`;
      startDate = `${year}-01-01`;
      endDate = `${year}-12-31`;
    }

    const [transactions, savingsCategoriesRaw] = await Promise.all([
      useSheets
        ? getTransactions(user!.sheetsId!, accessToken, periodArg)
        : getTransactionsDB(session.userId, periodArg),
      prisma.category.findMany({
        where: { userId: session.userId, isSavings: true },
        select: { name: true },
      }),
    ]);

    const savingsCategoryNames = new Set(savingsCategoriesRaw.map((c) => c.name.toLowerCase()));

    // ── Statement of Owner's Equity (Laporan Perubahan Ekuitas) ───────────────
    if (mode === "equity") {
      const movements = aggregateOwnerEquity(transactions, savingsCategoryNames);
      const beginningEquity = await netWorthAsOf(ctx, prevDay(startDate!));
      const endingEquity = await netWorthAsOf(ctx, endDate!);
      const reconciliation =
        endingEquity -
        (beginningEquity + movements.netIncome - movements.withdrawals + movements.adjustments);
      return NextResponse.json(
        {
          periodLabel,
          ownerName,
          generatedAt,
          beginningEquity,
          endingEquity,
          ...movements,
          reconciliation,
        },
        { headers: HEADERS },
      );
    }

    // ── Income Statement (Laba Rugi) ──────────────────────────────────────────
    if (isYearly) {
      const { income, expense } = aggregateYearlyReport(transactions, yearOut, savingsCategoryNames);
      return NextResponse.json({ year: yearOut, ownerName, generatedAt, income, expense }, { headers: HEADERS });
    }

    const { income, expense } = aggregatePeriodReport(transactions, savingsCategoryNames);
    const base = { periodLabel, ownerName, generatedAt, income, expense };

    if (mode === "custom" && startDate && endDate) {
      return NextResponse.json(
        { ...base, startDate, endDate, daysInRange: daysBetween(startDate, endDate) },
        { headers: HEADERS },
      );
    }

    return NextResponse.json(base, { headers: HEADERS });
  } catch (error: unknown) {
    console.error("[report endpoint]", error);
    return NextResponse.json({ error: "Gagal memuat laporan." }, { status: 500 });
  }
}
