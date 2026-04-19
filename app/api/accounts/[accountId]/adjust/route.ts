import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { getSingleAccountBalance } from "@/utils/account-balance";

type Params = { params: Promise<{ accountId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accountId } = await params;
  const body = await req.json();
  const { targetBalance, note } = body;

  if (targetBalance === undefined || targetBalance === null) {
    return NextResponse.json({ error: "targetBalance diperlukan." }, { status: 400 });
  }

  const target = new Decimal(Number(targetBalance));
  if (!target.isFinite()) {
    return NextResponse.json({ error: "Nilai target tidak valid." }, { status: 400 });
  }

  // Validasi ownership
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  if (account.userId !== session.userId) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const current = await getSingleAccountBalance(session.userId, accountId);
  const diff = target.minus(current);

  if (diff.isZero()) {
    return NextResponse.json({ message: "Saldo sudah sesuai, tidak ada perubahan." });
  }

  const today = new Date().toISOString().slice(0, 10);

  await prisma.transaction.create({
    data: {
      userId: session.userId,
      accountId,
      type: diff.isPositive() ? "income" : "expense",
      amount: diff.abs(),
      category: "Penyesuaian Saldo",
      date: today,
      note: note ?? "Koreksi saldo manual",
      isInitialBalance: false,
    },
  });

  return NextResponse.json({
    message: `Saldo disesuaikan ${diff.isPositive() ? "naik" : "turun"} Rp ${diff.abs().toNumber().toLocaleString("id-ID")}.`,
    previousBalance: current.toString(),
    newBalance: target.toString(),
  });
}
