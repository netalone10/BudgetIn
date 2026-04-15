import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/utils/token";
import { updateTransaction, deleteTransaction } from "@/utils/sheets";
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
      select: { userId: true },
    });
    if (!existing) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    if (existing.userId !== session.userId) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    try {
      await updateTransactionDB(session.userId, recordId, {
        date: body.date,
        amount: body.amount,
        category: body.category,
        note: body.note,
      });
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
    await updateTransaction(user.sheetsId, accessToken, recordId, {
      date: body.date,
      amount: body.amount,
      category: body.category,
      note: body.note,
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
      select: { userId: true },
    });
    if (!existing) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    if (existing.userId !== session.userId) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    try {
      await deleteTransactionDB(session.userId, recordId);
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
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Gagal hapus transaksi." }, { status: 500 });
  }
}
