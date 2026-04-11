import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/utils/token";
import { updateTransaction, deleteTransaction } from "@/utils/sheets";

type Params = { params: Promise<{ recordId: string }> };

// PATCH /api/record/[recordId] — edit transaksi
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { recordId } = await params; // Next.js 16: params adalah Promise

  const body = await req.json();

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  if (!user?.sheetsId) {
    return NextResponse.json({ error: "Sheets tidak ditemukan" }, { status: 400 });
  }

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

    return NextResponse.json({ success: true, message: "Transaksi diupdate." });
  } catch {
    return NextResponse.json(
      { error: "Gagal update transaksi. Coba lagi." },
      { status: 500 }
    );
  }
}

// DELETE /api/record/[recordId] — hapus transaksi
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { recordId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  if (!user?.sheetsId) {
    return NextResponse.json({ error: "Sheets tidak ditemukan" }, { status: 400 });
  }

  let accessToken: string;
  try {
    accessToken = await getValidToken(session.userId);
  } catch {
    return NextResponse.json({ error: "Sesi expired. Login ulang." }, { status: 401 });
  }

  try {
    await deleteTransaction(user.sheetsId, accessToken, recordId);
    return NextResponse.json({ success: true, message: "Transaksi dihapus." });
  } catch {
    return NextResponse.json(
      { error: "Gagal hapus transaksi. Coba lagi." },
      { status: 500 }
    );
  }
}
