import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getFamilyLedger,
  getFamilyNetWorth,
  summarizeFamily,
} from "@/lib/family-data";

// GET /api/family/dashboard?period=bulan ini
// Data konsolidasi keluarga: net worth + ringkasan spending/income + ledger.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "bulan ini";

  const [ledger, netWorth] = await Promise.all([
    getFamilyLedger(session.userId, period),
    getFamilyNetWorth(session.userId),
  ]);

  if (!ledger || !netWorth) {
    return NextResponse.json({ family: null });
  }

  // Union nama kategori tabungan semua anggota (lowercase) untuk dikecualikan
  // dari spending. Kategori selalu di Postgres untuk semua user.
  const savingsCats = await prisma.category.findMany({
    where: {
      userId: { in: ledger.members.map((m) => m.userId) },
      isSavings: true,
    },
    select: { name: true },
  });
  const savingsCategoryNames = new Set(
    savingsCats.map((c) => c.name.toLowerCase())
  );

  const summary = summarizeFamily(ledger.transactions, savingsCategoryNames);

  // Kirim transaksi terbaru saja (200) untuk daftar.
  const recent = [...ledger.transactions]
    .sort((a, b) =>
      a.date === b.date ? b.time.localeCompare(a.time) : b.date.localeCompare(a.date)
    )
    .slice(0, 200);

  return NextResponse.json({
    family: ledger.family,
    period,
    members: ledger.members,
    netWorth,
    summary,
    transactions: recent,
  });
}
