import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/utils/token";
import { updateTransaction, deleteTransaction, getAccounts, getTransactionRow } from "@/utils/sheets";
import { updateTransactionDB, deleteTransactionDB } from "@/utils/db-transactions";

type Params = { params: Promise<{ recordId: string }> };

function isValidTransactionAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount !== 0 && Math.abs(amount) <= 1_000_000_000;
}

function isValidTransferAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= 1_000_000_000;
}

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

    if (body.amount !== undefined) {
      const parsedAmount = Number(body.amount);
      const validAmount = existing.transferId
        ? isValidTransferAmount(parsedAmount)
        : isValidTransactionAmount(parsedAmount);
      if (!validAmount) {
        return NextResponse.json(
          { error: existing.transferId ? "Nominal transfer harus lebih dari 0." : "Nominal tidak boleh 0." },
          { status: 400 }
        );
      }
      body.amount = parsedAmount;
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
    if (body.amount !== undefined) {
      const existing = await getTransactionRow(user.sheetsId, accessToken, recordId);
      if (!existing) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
      const parsedAmount = Number(body.amount);
      const isTransfer = !!existing.fromAccountId && !!existing.toAccountId;
      const validAmount = isTransfer
        ? isValidTransferAmount(parsedAmount)
        : isValidTransactionAmount(parsedAmount);
      if (!validAmount) {
        return NextResponse.json(
          { error: isTransfer ? "Nominal transfer harus lebih dari 0." : "Nominal tidak boleh 0." },
          { status: 400 }
        );
      }
      body.amount = parsedAmount;
    }

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
    // Sheets: saldo dihitung pure-ledger di pembacaan; tidak perlu revert/reapply cache.
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
    await deleteTransaction(user.sheetsId, accessToken, recordId);
    // Sheets: saldo dihitung pure-ledger di pembacaan; tidak perlu revert cache.
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Gagal hapus transaksi." }, { status: 500 });
  }
}
