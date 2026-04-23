import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/utils/token";
import { updateTransaction, deleteTransaction, getTransactionRow, getAccounts, updateAccountBalance } from "@/utils/sheets";
import { updateTransactionDB, deleteTransactionDB } from "@/utils/db-transactions";

type Params = { params: Promise<{ recordId: string }> };

// PATCH /api/record/[recordId] — edit transaksi
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { recordId } = await params;
  const body = await req.json();

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  // ── Email user: update di DB ───────────────────────────────────────────────
  if (!user?.sheetsId) {
    // Verifikasi kepemilikan sebelum update
    const existing = await prisma.transaction.findUnique({
      where: { id: recordId },
      select: { userId: true, isInitialBalance: true, transferId: true },
    });
    if (!existing) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    if (existing.userId !== session.userId) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    // Guard: transaksi saldo awal tidak boleh diedit amount-nya via endpoint ini
    if (existing.isInitialBalance && body.amount !== undefined) {
      return NextResponse.json(
        { error: "Gunakan fitur 'Sesuaikan Saldo' di halaman Akun untuk mengubah saldo awal." },
        { status: 403 }
      );
    }

    try {
      // Transfer pair: update kedua row sekaligus via transferId
      if (existing.transferId && (body.amount !== undefined || body.date !== undefined || body.note !== undefined)) {
        await prisma.transaction.updateMany({
          where: { transferId: existing.transferId },
          data: {
            ...(body.date !== undefined && { date: body.date }),
            ...(body.amount !== undefined && { amount: body.amount }),
            ...(body.note !== undefined && { note: body.note }),
          },
        });
      } else {
        await updateTransactionDB(session.userId, recordId, {
          date: body.date,
          amount: body.amount,
          category: body.category,
          note: body.note,
          accountId: body.accountId,
        });
      }
      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ error: "Gagal update transaksi." }, { status: 500 });
    }
  }

  // ── Google user: update di Sheets ─────────────────────────────────────────
  let accessToken: string;
  try {
    accessToken = await getValidToken(session.userId);
  } catch {
    return NextResponse.json({ error: "Sesi expired. Login ulang." }, { status: 401 });
  }

  try {
    let fromAccountId: string | undefined;
    let fromAccountName: string | undefined;
    if (body.accountId !== undefined) {
      if (!body.accountId) {
        fromAccountId = "";
        fromAccountName = "";
      } else {
        const accounts = await getAccounts(user.sheetsId, accessToken);
        const acc = accounts.find((a) => a.id === body.accountId);
        fromAccountId = body.accountId;
        fromAccountName = acc?.name ?? "";
      }
    }
    await updateTransaction(user.sheetsId, accessToken, recordId, {
      date: body.date,
      amount: body.amount,
      category: body.category,
      note: body.note,
      ...(fromAccountId !== undefined && { fromAccountId, fromAccountName }),
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Gagal update transaksi." }, { status: 500 });
  }
}

// DELETE /api/record/[recordId] — hapus transaksi
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { recordId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  // ── Email user: hapus dari DB ─────────────────────────────────────────────
  if (!user?.sheetsId) {
    // Verifikasi kepemilikan sebelum hapus
    const existing = await prisma.transaction.findUnique({
      where: { id: recordId },
      select: { userId: true, isInitialBalance: true, transferId: true },
    });
    if (!existing) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    if (existing.userId !== session.userId) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    // Guard: transaksi saldo awal tidak boleh dihapus via endpoint ini
    if (existing.isInitialBalance) {
      return NextResponse.json(
        { error: "Gunakan fitur 'Sesuaikan Saldo' di halaman Akun untuk mengubah saldo awal." },
        { status: 403 }
      );
    }

    try {
      // Transfer pair: hapus kedua row sekaligus
      if (existing.transferId) {
        await prisma.transaction.deleteMany({
          where: { transferId: existing.transferId },
        });
      } else {
        await deleteTransactionDB(session.userId, recordId);
      }
      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ error: "Gagal hapus transaksi." }, { status: 500 });
    }
  }

  // ── Google user: hapus dari Sheets ───────────────────────────────────────
  let accessToken: string;
  try {
    accessToken = await getValidToken(session.userId);
  } catch {
    return NextResponse.json({ error: "Sesi expired. Login ulang." }, { status: 401 });
  }

  try {
    // Read tx and accounts in parallel before deleting so we can revert balance
    const [tx, accounts] = await Promise.all([
      getTransactionRow(user.sheetsId, accessToken, recordId),
      getAccounts(user.sheetsId, accessToken),
    ]);

    await deleteTransaction(user.sheetsId, accessToken, recordId);

    // Revert balance: only for transactions that recorded account IDs
    if (tx) {
      const reversals: Promise<void>[] = [];
      if (tx.fromAccountId) {
        const acc = accounts.find((a) => a.id === tx.fromAccountId);
        if (acc) {
          // Original delta for fromAccount: asset→−amount, liability→+amount. Revert = opposite.
          const revertDelta = acc.classification === "liability" ? -tx.amount : tx.amount;
          reversals.push(updateAccountBalance(user!.sheetsId!, accessToken, tx.fromAccountId, revertDelta, accounts).catch(() => {}));
        }
      }
      if (tx.toAccountId) {
        const acc = accounts.find((a) => a.id === tx.toAccountId);
        if (acc) {
          // Original delta for toAccount: asset→+amount, liability→−amount. Revert = opposite.
          const revertDelta = acc.classification === "liability" ? tx.amount : -tx.amount;
          reversals.push(updateAccountBalance(user!.sheetsId!, accessToken, tx.toAccountId, revertDelta, accounts).catch(() => {}));
        }
      }
      await Promise.all(reversals);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Gagal hapus transaksi." }, { status: 500 });
  }
}
