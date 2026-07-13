import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/utils/token";
import { getTransactions, deleteTransaction } from "@/utils/sheets";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { sheetsId: true },
    });

    if (!user?.sheetsId) {
      return NextResponse.json({ error: "User bukan Sheets user." }, { status: 400 });
    }

    let accessToken: string;
    try {
      accessToken = await getValidToken(session.userId);
    } catch {
      return NextResponse.json({ error: "Sesi Google expired." }, { status: 401 });
    }

    // Read all transactions from Sheets
    const allTx = await getTransactions(user.sheetsId, accessToken);

    // Find cicilan purchase duplicates (note contains "pembelian cicilan")
    const cicilanPurchases = allTx.filter(
      (tx) => tx.note && tx.note.includes("pembelian cicilan")
    );

    // Group by note (same note = same cicilan purchase)
    const groups = new Map<string, typeof cicilanPurchases>();
    for (const tx of cicilanPurchases) {
      const key = tx.note!;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(tx);
    }

    const deleted: { id: string; note: string }[] = [];
    const kept: { id: string; note: string }[] = [];

    for (const [note, txs] of Array.from(groups.entries())) {
      if (txs.length <= 1) {
        kept.push({ id: txs[0].id, note });
        continue;
      }

      // Sort by id (UUID v4, so timestamp-based order isn't guaranteed)
      // But since these were created in sequence, we keep the LAST one
      // (highest index in sheet = most recent entry)
      const toKeep = txs[txs.length - 1];
      const toDelete = txs.slice(0, -1);

      kept.push({ id: toKeep.id, note });

      for (const tx of toDelete) {
        try {
          // Delete from Sheets
          await deleteTransaction(user.sheetsId, accessToken, tx.id);
          // Delete from Postgres mirror
          await prisma.transaction.deleteMany({ where: { id: tx.id } });
          deleted.push({ id: tx.id, note });
        } catch (err) {
          console.error(`[cleanup] Failed to delete ${tx.id}:`, err);
        }
      }
    }

    return NextResponse.json({
      summary: {
        totalCicilanPurchases: cicilanPurchases.length,
        groupsFound: groups.size,
        deleted: deleted.length,
        kept: kept.length,
      },
      deleted,
      kept,
    });
  } catch (error) {
    console.error("[cicilan-cleanup]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
