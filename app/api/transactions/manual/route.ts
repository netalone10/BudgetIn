import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { randomUUID } from "crypto";

function isValidAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= 1_000_000_000;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type, amount, accountId, toAccountId, category, date, note } = body;

  // Validasi amount
  const parsedAmount = Number(amount);
  if (!isValidAmount(parsedAmount)) {
    return NextResponse.json({ error: "Nominal tidak valid." }, { status: 400 });
  }

  // Validasi date
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!date || !dateRegex.test(date)) {
    return NextResponse.json({ error: "Format tanggal tidak valid (YYYY-MM-DD)." }, { status: 400 });
  }

  const decimalAmount = new Decimal(parsedAmount);

  if (type === "expense" || type === "income") {
    if (!accountId) {
      return NextResponse.json({ error: "Akun harus dipilih." }, { status: 400 });
    }
    if (!category || typeof category !== "string" || category.trim().length === 0) {
      return NextResponse.json({ error: "Kategori harus dipilih." }, { status: 400 });
    }

    // Validasi ownership akun
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account || account.userId !== session.userId || !account.isActive) {
      return NextResponse.json({ error: "Akun tidak valid." }, { status: 404 });
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId: session.userId,
        accountId,
        type,
        amount: decimalAmount,
        category: category.trim(),
        date,
        note: note ?? "",
      },
    });

    // Upsert kategori agar muncul di dropdown berikutnya
    await prisma.category.upsert({
      where: { userId_name: { userId: session.userId, name: category.trim() } },
      update: {},
      create: {
        userId: session.userId,
        name: category.trim(),
        type: type === "income" ? "income" : "expense",
      },
    });

    return NextResponse.json({ transaction }, { status: 201 });
  }

  if (type === "transfer") {
    if (!accountId) {
      return NextResponse.json({ error: "Akun asal harus dipilih." }, { status: 400 });
    }
    if (!toAccountId) {
      return NextResponse.json({ error: "Akun tujuan harus dipilih." }, { status: 400 });
    }
    if (accountId === toAccountId) {
      return NextResponse.json({ error: "Akun asal dan tujuan tidak boleh sama." }, { status: 400 });
    }

    // Fetch kedua akun sekaligus
    const [fromAccount, toAccount] = await Promise.all([
      prisma.account.findUnique({ where: { id: accountId } }),
      prisma.account.findUnique({ where: { id: toAccountId } }),
    ]);

    if (!fromAccount || fromAccount.userId !== session.userId || !fromAccount.isActive) {
      return NextResponse.json({ error: "Akun asal tidak valid." }, { status: 404 });
    }
    if (!toAccount || toAccount.userId !== session.userId || !toAccount.isActive) {
      return NextResponse.json({ error: "Akun tujuan tidak valid." }, { status: 404 });
    }

    // Guard cross-currency
    if (fromAccount.currency !== toAccount.currency) {
      return NextResponse.json(
        {
          error: `Transfer beda mata uang belum didukung (${fromAccount.currency} → ${toAccount.currency}). Catat sebagai pengeluaran dan pemasukan terpisah.`,
        },
        { status: 400 }
      );
    }

    const transferId = randomUUID();
    const transferNote = note ?? "";

    await prisma.$transaction([
      prisma.transaction.create({
        data: {
          userId: session.userId,
          accountId,
          type: "transfer_out",
          amount: decimalAmount,
          category: "Transfer",
          date,
          note: transferNote,
          transferId,
        },
      }),
      prisma.transaction.create({
        data: {
          userId: session.userId,
          accountId: toAccountId,
          type: "transfer_in",
          amount: decimalAmount,
          category: "Transfer",
          date,
          note: transferNote,
          transferId,
        },
      }),
    ]);

    return NextResponse.json({ transferId, message: "Transfer berhasil dicatat." }, { status: 201 });
  }

  return NextResponse.json({ error: "Tipe transaksi tidak valid." }, { status: 400 });
}
