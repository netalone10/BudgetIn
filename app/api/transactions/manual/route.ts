import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { randomUUID } from "crypto";
import { getValidToken } from "@/utils/token";
import { appendTransaction, getAccounts } from "@/utils/sheets";

function isValidTransactionAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount !== 0 && Math.abs(amount) <= 1_000_000_000;
}

function isValidTransferAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= 1_000_000_000;
}

const TRANSFER_FEE_CATEGORY = "Biaya Admin";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type, amount, accountId, toAccountId, category, date, note, fee } = body;

  const parsedAmount = Number(amount);
  const parsedFee = fee === undefined || fee === null || fee === "" ? 0 : Number(fee);
  if (!Number.isFinite(parsedAmount)) {
    return NextResponse.json({ error: "Nominal tidak valid." }, { status: 400 });
  }
  if (!Number.isFinite(parsedFee) || parsedFee < 0 || parsedFee > 1_000_000_000) {
    return NextResponse.json({ error: "Fee tidak valid." }, { status: 400 });
  }

  // Validasi date
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!date || !dateRegex.test(date)) {
    return NextResponse.json({ error: "Format tanggal tidak valid (YYYY-MM-DD)." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });
  const useSheets = !!user?.sheetsId;

  // ── GOOGLE SHEETS PATH ────────────────────────────────────────────────────────
  if (useSheets) {
    let accessToken: string;
    try {
      accessToken = await getValidToken(session.userId);
    } catch {
      return NextResponse.json({ error: "Sesi expired. Silakan login ulang." }, { status: 401 });
    }

    const sheetsAccounts = await getAccounts(user!.sheetsId!, accessToken);

    if (type === "expense" || type === "income") {
      if (!isValidTransactionAmount(parsedAmount)) {
        return NextResponse.json({ error: "Nominal tidak boleh 0." }, { status: 400 });
      }
      if (!accountId) return NextResponse.json({ error: "Akun harus dipilih." }, { status: 400 });
      if (!category?.trim()) return NextResponse.json({ error: "Kategori harus dipilih." }, { status: 400 });

      const account = sheetsAccounts.find((a) => a.id === accountId);
      if (!account) return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 400 });

      const transaction = await appendTransaction(user!.sheetsId!, accessToken, {
        date,
        amount: parsedAmount,
        category: category.trim(),
        note: note ?? "",
        type,
        ...(type === "expense"
          ? { fromAccountId: accountId, fromAccountName: account.name }
          : { toAccountId: accountId, toAccountName: account.name }),
      });

      // Sheets: saldo dihitung pure-ledger via getAccountsWithBalance (no cache write).

      await prisma.category.upsert({
        where: { userId_name: { userId: session.userId, name: category.trim() } },
        update: {},
        create: { userId: session.userId, name: category.trim(), type: type === "income" ? "income" : "expense" },
      });

      return NextResponse.json({ transaction, accountName: account.name }, { status: 201 });
    }

    if (type === "transfer") {
      if (!isValidTransferAmount(parsedAmount)) {
        return NextResponse.json({ error: "Nominal transfer harus lebih dari 0." }, { status: 400 });
      }
      if (!accountId) return NextResponse.json({ error: "Akun asal harus dipilih." }, { status: 400 });
      if (!toAccountId) return NextResponse.json({ error: "Akun tujuan harus dipilih." }, { status: 400 });
      if (accountId === toAccountId) return NextResponse.json({ error: "Akun asal dan tujuan tidak boleh sama." }, { status: 400 });

      const fromAccount = sheetsAccounts.find((a) => a.id === accountId);
      const toAccount = sheetsAccounts.find((a) => a.id === toAccountId);

      if (!fromAccount) return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 400 });
      if (!toAccount) return NextResponse.json({ error: "Akun tujuan tidak ditemukan" }, { status: 400 });
      if (fromAccount.currency !== toAccount.currency) {
        return NextResponse.json({
          error: `Transfer beda mata uang belum didukung (${fromAccount.currency} → ${toAccount.currency}). Catat sebagai pengeluaran dan pemasukan terpisah.`,
        }, { status: 400 });
      }

      const transaction = await appendTransaction(user!.sheetsId!, accessToken, {
        date,
        amount: parsedAmount,
        category: "Transfer",
        note: note ?? "",
        type: "expense",
        fromAccountId: accountId,
        fromAccountName: fromAccount.name,
        toAccountId,
        toAccountName: toAccount.name,
      });

      let feeTransaction = null;
      if (parsedFee > 0) {
        feeTransaction = await appendTransaction(user!.sheetsId!, accessToken, {
          date,
          amount: parsedFee,
          category: TRANSFER_FEE_CATEGORY,
          note: note ? `Fee transfer - ${note}` : "Fee transfer",
          type: "expense",
          fromAccountId: accountId,
          fromAccountName: fromAccount.name,
        });

        await prisma.category.upsert({
          where: { userId_name: { userId: session.userId, name: TRANSFER_FEE_CATEGORY } },
          update: {},
          create: { userId: session.userId, name: TRANSFER_FEE_CATEGORY, type: "expense" },
        });
      }

      // Sheets: saldo dihitung pure-ledger (no cache write). Transfer terekam sebagai
      // 1 row expense dengan from+to terisi; getAccountsWithBalance akan menghitung
      // delta untuk kedua akun dari ledger.

      return NextResponse.json({ transaction, feeTransaction, message: "Transfer berhasil dicatat." }, { status: 201 });
    }

    return NextResponse.json({ error: "Tipe transaksi tidak valid." }, { status: 400 });
  }

  // ── PRISMA / EMAIL PATH ───────────────────────────────────────────────────────
  const decimalAmount = new Decimal(parsedAmount);

  if (type === "expense" || type === "income") {
    if (!isValidTransactionAmount(parsedAmount)) {
      return NextResponse.json({ error: "Nominal tidak boleh 0." }, { status: 400 });
    }
    if (!accountId) {
      return NextResponse.json({ error: "Akun harus dipilih." }, { status: 400 });
    }
    if (!category || typeof category !== "string" || category.trim().length === 0) {
      return NextResponse.json({ error: "Kategori harus dipilih." }, { status: 400 });
    }

    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) {
      return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 400 });
    }
    if (account.userId !== session.userId) {
      return NextResponse.json({ error: "Akun tidak valid" }, { status: 400 });
    }
    if (!account.isActive) {
      return NextResponse.json({ error: "Akun sudah dinonaktifkan" }, { status: 400 });
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

    await prisma.category.upsert({
      where: { userId_name: { userId: session.userId, name: category.trim() } },
      update: {},
      create: {
        userId: session.userId,
        name: category.trim(),
        type: type === "income" ? "income" : "expense",
      },
    });

    return NextResponse.json({ transaction, accountName: account.name }, { status: 201 });
  }

  if (type === "transfer") {
    if (!isValidTransferAmount(parsedAmount)) {
      return NextResponse.json({ error: "Nominal transfer harus lebih dari 0." }, { status: 400 });
    }
    if (!accountId) {
      return NextResponse.json({ error: "Akun asal harus dipilih." }, { status: 400 });
    }
    if (!toAccountId) {
      return NextResponse.json({ error: "Akun tujuan harus dipilih." }, { status: 400 });
    }
    if (accountId === toAccountId) {
      return NextResponse.json({ error: "Akun asal dan tujuan tidak boleh sama." }, { status: 400 });
    }

    const [fromAccount, toAccount] = await Promise.all([
      prisma.account.findUnique({ where: { id: accountId } }),
      prisma.account.findUnique({ where: { id: toAccountId } }),
    ]);

    if (!fromAccount) {
      return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 400 });
    }
    if (fromAccount.userId !== session.userId) {
      return NextResponse.json({ error: "Akun tidak valid" }, { status: 400 });
    }
    if (!fromAccount.isActive) {
      return NextResponse.json({ error: "Akun sudah dinonaktifkan" }, { status: 400 });
    }
    if (!toAccount) {
      return NextResponse.json({ error: "Akun tujuan tidak ditemukan" }, { status: 400 });
    }
    if (toAccount.userId !== session.userId) {
      return NextResponse.json({ error: "Akun tujuan tidak valid" }, { status: 400 });
    }
    if (!toAccount.isActive) {
      return NextResponse.json({ error: "Akun tujuan sudah dinonaktifkan" }, { status: 400 });
    }

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
      ...(parsedFee > 0
        ? [
            prisma.transaction.create({
              data: {
                userId: session.userId,
                accountId,
                type: "expense",
                amount: new Decimal(parsedFee),
                category: TRANSFER_FEE_CATEGORY,
                date,
                note: transferNote ? `Fee transfer - ${transferNote}` : "Fee transfer",
              },
            }),
          ]
        : []),
    ]);

    if (parsedFee > 0) {
      await prisma.category.upsert({
        where: { userId_name: { userId: session.userId, name: TRANSFER_FEE_CATEGORY } },
        update: {},
        create: {
          userId: session.userId,
          name: TRANSFER_FEE_CATEGORY,
          type: "expense",
        },
      });
    }

    return NextResponse.json({ transferId, message: "Transfer berhasil dicatat." }, { status: 201 });
  }

  return NextResponse.json({ error: "Tipe transaksi tidak valid." }, { status: 400 });
}
