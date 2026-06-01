import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/utils/token";
import { getTransactions } from "@/utils/sheets";
import { getTransactionsDB } from "@/utils/db-transactions";
import { compareTransactionDateTimeDesc } from "@/lib/transaction-time";
import { buildTransactionsCsv, type CsvTransactionRow } from "@/lib/csv";
import { format } from "date-fns";

/** Batas aman jumlah baris per export agar payload tidak membengkak. */
const MAX_EXPORT_ROWS = 5000;

// User-specific data — jangan di-cache.
export const dynamic = "force-dynamic";

/**
 * GET /api/export/csv?period=...&from=...&to=...
 *
 * Export transaksi pada periode tertentu sebagai file CSV (attachment).
 * Menerima parameter periode yang sama dengan GET /api/record.
 * Hanya transaksi milik session user yang di-export.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.userId;

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "bulan ini";
  const customFrom = searchParams.get("from");
  const customTo = searchParams.get("to");

  const resolvedPeriod =
    period === "custom" && customFrom && customTo
      ? `custom:${customFrom}:${customTo}`
      : period;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sheetsId: true },
  });

  let rows: CsvTransactionRow[] = [];

  try {
    if (!user?.sheetsId) {
      // ── Email user: baca dari DB ──────────────────────────────────────────
      const [transactions, accounts] = await Promise.all([
        getTransactionsDB(userId, resolvedPeriod),
        prisma.account.findMany({
          where: { userId },
          select: { id: true, name: true },
        }),
      ]);
      const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));
      rows = transactions.map((t) => ({
        date: t.date,
        time: t.time,
        type: t.type,
        category: t.category,
        amount: t.amount,
        accountName: t.accountId ? accountNameById.get(t.accountId) ?? "" : "",
        toAccountName: "",
        note: t.note,
      }));
    } else {
      // ── Google user: baca dari Sheets ─────────────────────────────────────
      let accessToken: string;
      try {
        accessToken = await getValidToken(userId);
      } catch {
        return NextResponse.json({ error: "token_expired" }, { status: 401 });
      }
      const transactions = await getTransactions(user.sheetsId, accessToken, resolvedPeriod);
      transactions.sort(compareTransactionDateTimeDesc);
      rows = transactions.map((t) => ({
        date: t.date,
        time: t.time,
        type: t.type,
        category: t.category,
        amount: t.amount,
        accountName: t.fromAccountName ?? "",
        toAccountName: t.toAccountName ?? "",
        note: t.note,
      }));
    }
  } catch (error) {
    console.error("CSV export failed:", error);
    return NextResponse.json({ error: "Gagal menyiapkan export." }, { status: 500 });
  }

  if (rows.length > MAX_EXPORT_ROWS) {
    rows = rows.slice(0, MAX_EXPORT_ROWS);
  }

  const csv = buildTransactionsCsv(rows);
  const stamp = format(new Date(), "yyyyMMdd");
  const filename = `budgetin-transaksi-${stamp}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
