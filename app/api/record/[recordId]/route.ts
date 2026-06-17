import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/utils/token";
import { updateTransaction, deleteTransaction, getAccounts, getTransactionRow } from "@/utils/sheets";
import { updateTransactionDB, deleteTransactionDB } from "@/utils/db-transactions";
import { isValidTransactionTime } from "@/lib/transaction-time";
import { blockDemoResponse } from "@/lib/demo-account";
import { invalidateDashboardCache } from "@/lib/cache";

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
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
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
      select: { userId: true, isInitialBalance: true, transferId: true, type: true },
    });
    if (!existing) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    if (existing.userId !== session.userId) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    // Target tipe (kalau client minta ubah tipe transaksi). undefined = tidak diubah.
    const targetType: "expense" | "income" | "transfer" | undefined =
      body.type === "expense" || body.type === "income" || body.type === "transfer" ? body.type : undefined;
    const isTransferNow = !!existing.transferId;

    // Guard: transaksi saldo awal tidak boleh diedit amount/tipe-nya via endpoint ini
    if (existing.isInitialBalance && (body.amount !== undefined || targetType !== undefined)) {
      return NextResponse.json(
        { error: "Gunakan fitur 'Sesuaikan Saldo' di halaman Akun untuk mengubah saldo awal." },
        { status: 403 }
      );
    }

    if (body.amount !== undefined) {
      const parsedAmount = Number(body.amount);
      const wantTransfer = targetType === "transfer" || (targetType === undefined && isTransferNow);
      const validAmount = wantTransfer
        ? isValidTransferAmount(parsedAmount)
        : isValidTransactionAmount(parsedAmount);
      if (!validAmount) {
        return NextResponse.json(
          { error: wantTransfer ? "Nominal transfer harus lebih dari 0." : "Nominal tidak boleh 0." },
          { status: 400 }
        );
      }
      body.amount = parsedAmount;
    }
    if (body.time !== undefined && !isValidTransactionTime(body.time)) {
      return NextResponse.json({ error: "Format jam tidak valid (HH:mm)." }, { status: 400 });
    }

    try {
      if (targetType === "transfer") {
        // ── Target: transfer ──────────────────────────────────────────────
        const fromAccountId = body.fromAccountId || null;
        const toAccountId = body.toAccountId || null;
        const sharedTransfer = {
          ...(body.date !== undefined && { date: body.date }),
          ...(body.time !== undefined && { time: body.time }),
          ...(body.amount !== undefined && { amount: body.amount }),
          ...(body.note !== undefined && { note: body.note }),
          category: "Transfer",
        };

        if (isTransferNow) {
          // Sudah transfer → update kedua leg, reassign akun bila keduanya dikirim
          const legs = await prisma.transaction.findMany({
            where: { transferId: existing.transferId! },
            select: { id: true, type: true },
          });
          const reassign = !!fromAccountId && !!toAccountId && fromAccountId !== toAccountId;
          await prisma.$transaction(
            legs.map((leg) =>
              prisma.transaction.update({
                where: { id: leg.id },
                data: {
                  ...sharedTransfer,
                  ...(reassign && { accountId: leg.type === "transfer_in" ? toAccountId : fromAccountId }),
                },
              })
            )
          );
        } else {
          // single → transfer: butuh dua akun berbeda, buat leg pasangan
          if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) {
            return NextResponse.json({ error: "Pilih akun asal dan tujuan yang berbeda." }, { status: 400 });
          }
          const current = await prisma.transaction.findUnique({
            where: { id: recordId },
            select: { date: true, time: true, amount: true, note: true },
          });
          const transferId = randomUUID();
          await prisma.$transaction([
            prisma.transaction.update({
              where: { id: recordId },
              data: { ...sharedTransfer, type: "transfer_out", accountId: fromAccountId, transferId },
            }),
            prisma.transaction.create({
              data: {
                userId: session.userId,
                type: "transfer_in",
                accountId: toAccountId,
                category: "Transfer",
                transferId,
                date: body.date ?? current!.date,
                time: body.time ?? current!.time,
                amount: body.amount ?? current!.amount,
                note: body.note ?? current!.note,
              },
            }),
          ]);
        }
      } else if (targetType === "expense" || targetType === "income") {
        // ── Target: expense / income (transaksi tunggal) ──────────────────
        const accountId = body.accountId || null;
        const singleData = {
          type: targetType,
          ...(body.accountId !== undefined && { accountId }),
          ...(body.category !== undefined && { category: body.category }),
          ...(body.date !== undefined && { date: body.date }),
          ...(body.time !== undefined && { time: body.time }),
          ...(body.amount !== undefined && { amount: body.amount }),
          ...(body.note !== undefined && { note: body.note }),
        };

        if (isTransferNow) {
          // transfer → tunggal: simpan row ini, hapus leg pasangan
          await prisma.$transaction([
            prisma.transaction.update({
              where: { id: recordId },
              data: { ...singleData, accountId, transferId: null },
            }),
            prisma.transaction.deleteMany({
              where: { transferId: existing.transferId!, id: { not: recordId } },
            }),
          ]);
        } else {
          // expense ↔ income (tetap satu row)
          await prisma.transaction.update({ where: { id: recordId }, data: singleData });
        }
      } else if (existing.transferId && (body.amount !== undefined || body.date !== undefined || body.time !== undefined || body.note !== undefined || body.category !== undefined || body.accountId !== undefined)) {
        // ── Tanpa ubah tipe: transfer pair, update kedua row sekaligus ────
        await prisma.transaction.updateMany({
          where: { transferId: existing.transferId },
          data: {
            ...(body.date !== undefined && { date: body.date }),
            ...(body.time !== undefined && { time: body.time }),
            ...(body.amount !== undefined && { amount: body.amount }),
            ...(body.category !== undefined && { category: body.category }),
            ...(body.note !== undefined && { note: body.note }),
            ...(body.accountId !== undefined && { accountId: body.accountId || null }),
          },
        });
      } else {
        // ── Tanpa ubah tipe: transaksi tunggal ───────────────────────────
        await updateTransactionDB(session.userId, recordId, {
          date: body.date,
          time: body.time,
          amount: body.amount,
          category: body.category,
          note: body.note,
          accountId: body.accountId,
        });
      }
      invalidateDashboardCache(session.userId);
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
    // Target tipe (kalau client minta ubah tipe transaksi). undefined = tidak diubah.
    const targetType: "expense" | "income" | "transfer" | undefined =
      body.type === "expense" || body.type === "income" || body.type === "transfer" ? body.type : undefined;

    // Butuh row saat ini untuk validasi nominal & deteksi transfer (from+to terisi).
    const existingRow =
      targetType !== undefined || body.amount !== undefined
        ? await getTransactionRow(user.sheetsId, accessToken, recordId)
        : null;
    if ((targetType !== undefined || body.amount !== undefined) && !existingRow) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    }
    const isTransferNow = !!existingRow?.fromAccountId && !!existingRow?.toAccountId;

    if (body.amount !== undefined) {
      const parsedAmount = Number(body.amount);
      const wantTransfer = targetType === "transfer" || (targetType === undefined && isTransferNow);
      const validAmount = wantTransfer
        ? isValidTransferAmount(parsedAmount)
        : isValidTransactionAmount(parsedAmount);
      if (!validAmount) {
        return NextResponse.json(
          { error: wantTransfer ? "Nominal transfer harus lebih dari 0." : "Nominal tidak boleh 0." },
          { status: 400 }
        );
      }
      body.amount = parsedAmount;
    }
    if (body.time !== undefined && !isValidTransactionTime(body.time)) {
      return NextResponse.json({ error: "Format jam tidak valid (HH:mm)." }, { status: 400 });
    }

    // ── Ubah tipe transaksi ──────────────────────────────────────────────────
    // Di Sheets, kolom akun beda per tipe: expense → fromAccount (H), income →
    // toAccount (J), transfer → keduanya terisi (type tetap "expense").
    if (targetType !== undefined) {
      const accounts = await getAccounts(user.sheetsId, accessToken);
      const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name ?? "";
      const shared = {
        ...(body.date !== undefined && { date: body.date }),
        ...(body.time !== undefined && { time: body.time }),
        ...(body.amount !== undefined && { amount: body.amount }),
        ...(body.note !== undefined && { note: body.note }),
      };

      if (targetType === "transfer") {
        const newFromId = body.fromAccountId || "";
        const newToId = body.toAccountId || "";
        if (!isTransferNow && (!newFromId || !newToId || newFromId === newToId)) {
          return NextResponse.json({ error: "Pilih akun asal dan tujuan yang berbeda." }, { status: 400 });
        }
        await updateTransaction(user.sheetsId, accessToken, recordId, {
          ...shared,
          type: "expense",
          category: "Transfer",
          ...(newFromId && newToId
            ? {
                fromAccountId: newFromId,
                fromAccountName: nameOf(newFromId),
                toAccountId: newToId,
                toAccountName: nameOf(newToId),
              }
            : {}),
        });
      } else if (targetType === "expense") {
        const accId = body.accountId || "";
        await updateTransaction(user.sheetsId, accessToken, recordId, {
          ...shared,
          type: "expense",
          ...(body.category !== undefined && { category: body.category }),
          fromAccountId: accId,
          fromAccountName: accId ? nameOf(accId) : "",
          toAccountId: "",
          toAccountName: "",
        });
      } else {
        // income → akun di toAccount (J), fromAccount dikosongkan
        const accId = body.accountId || "";
        await updateTransaction(user.sheetsId, accessToken, recordId, {
          ...shared,
          type: "income",
          ...(body.category !== undefined && { category: body.category }),
          fromAccountId: "",
          fromAccountName: "",
          toAccountId: accId,
          toAccountName: accId ? nameOf(accId) : "",
        });
      }

      // Sinkronkan savings mirror (no-op untuk transaksi biasa).
      await prisma.transaction.updateMany({
        where: { id: recordId, userId: session.userId },
        data: {
          ...(body.date !== undefined && { date: body.date }),
          ...(body.time !== undefined && { time: body.time }),
          ...(body.amount !== undefined && { amount: body.amount }),
          ...(body.category !== undefined && { category: body.category }),
          ...(body.note !== undefined && { note: body.note }),
        },
      });
      await prisma.savingsContribution.updateMany({
        where: { transactionId: recordId, userId: session.userId },
        data: {
          ...(body.date !== undefined && { date: body.date }),
          ...(body.amount !== undefined && { amount: body.amount }),
          ...(body.note !== undefined && { note: body.note }),
        },
      });
      invalidateDashboardCache(session.userId);
      return NextResponse.json({ success: true });
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
      time: body.time,
      amount: body.amount,
      category: body.category,
      note: body.note,
      ...(fromAccountId !== undefined && { fromAccountId, fromAccountName }),
    });
    // Keep the savings mirror Transaction + contribution in sync (no-op for
    // ordinary Sheets transactions). accountId is intentionally not mirrored.
    await prisma.transaction.updateMany({
      where: { id: recordId, userId: session.userId },
      data: {
        ...(body.date !== undefined && { date: body.date }),
        ...(body.time !== undefined && { time: body.time }),
        ...(body.amount !== undefined && { amount: body.amount }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.note !== undefined && { note: body.note }),
      },
    });
    await prisma.savingsContribution.updateMany({
      where: { transactionId: recordId, userId: session.userId },
      data: {
        ...(body.date !== undefined && { date: body.date }),
        ...(body.amount !== undefined && { amount: body.amount }),
        ...(body.note !== undefined && { note: body.note }),
      },
    });
    // Sheets: saldo dihitung pure-ledger di pembacaan; tidak perlu revert/reapply cache.
    invalidateDashboardCache(session.userId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Gagal update transaksi." }, { status: 500 });
  }
}

// DELETE /api/record/[recordId] — hapus transaksi
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
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
      invalidateDashboardCache(session.userId);
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
    // Savings transactions also have a mirror Transaction in Prisma (the FK
    // anchor for SavingsContribution). Remove it so the contribution doesn't
    // linger in the savings goal. deleteMany cascades to the contribution and is
    // a harmless no-op (0 rows) for ordinary Sheets transactions.
    await prisma.transaction.deleteMany({ where: { id: recordId, userId: session.userId } });
    // Sheets: saldo dihitung pure-ledger di pembacaan; tidak perlu revert cache.
    invalidateDashboardCache(session.userId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Gagal hapus transaksi." }, { status: 500 });
  }
}
