import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSingleAccountBalance } from "@/utils/account-balance";

type Params = { params: Promise<{ accountId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accountId } = await params;
  const body = await req.json();
  const { accountTypeId, name, color, icon, note, currency } = body;

  const existing = await prisma.account.findUnique({ where: { id: accountId } });
  if (!existing) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  if (existing.userId !== session.userId) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  // Lock currency jika ada transaksi
  if (currency && currency !== existing.currency) {
    const txCount = await prisma.transaction.count({ where: { accountId } });
    if (txCount > 0) {
      return NextResponse.json(
        { error: "Mata uang tidak bisa diubah setelah ada transaksi." },
        { status: 409 }
      );
    }
  }

  // Validasi accountTypeId jika diubah
  if (accountTypeId) {
    const accountType = await prisma.accountType.findUnique({ where: { id: accountTypeId } });
    if (!accountType || accountType.userId !== session.userId || !accountType.isActive) {
      return NextResponse.json({ error: "Tipe akun tidak valid." }, { status: 400 });
    }
  }

  if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
    return NextResponse.json({ error: "Nama tidak boleh kosong." }, { status: 400 });
  }

  const updated = await prisma.account.update({
    where: { id: accountId },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(accountTypeId !== undefined && { accountTypeId }),
      ...(color !== undefined && { color }),
      ...(icon !== undefined && { icon }),
      ...(note !== undefined && { note }),
      ...(currency !== undefined && { currency }),
    },
    include: { accountType: true },
  });

  return NextResponse.json({ account: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accountId } = await params;
  const { searchParams } = new URL(req.url);
  const hard = searchParams.get("hard") === "true";

  const existing = await prisma.account.findUnique({ where: { id: accountId } });
  if (!existing) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  if (existing.userId !== session.userId) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  if (hard) {
    // Hard-delete: hanya boleh kalau tidak ada transaksi sama sekali
    const txCount = await prisma.transaction.count({ where: { accountId } });
    if (txCount > 0) {
      return NextResponse.json(
        { error: `Akun ini memiliki ${txCount} transaksi. Hapus semua transaksi terlebih dahulu.` },
        { status: 409 }
      );
    }
    await prisma.account.delete({ where: { id: accountId } });
    return NextResponse.json({ message: "Akun dihapus permanen." });
  }

  // Soft-delete: hanya boleh kalau saldo = 0
  const currentBalance = await getSingleAccountBalance(session.userId, accountId);
  if (!currentBalance.isZero()) {
    const formatted = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
      currentBalance.toNumber()
    );
    return NextResponse.json(
      { error: `Saldo akun ini masih ${formatted}. Transfer atau sesuaikan saldo ke 0 sebelum mengarsipkan.` },
      { status: 400 }
    );
  }

  await prisma.account.update({
    where: { id: accountId },
    data: { isActive: false },
  });
  return NextResponse.json({ message: "Akun diarsipkan." });
}
