import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import {
  getAccountBalances,
  calculateNetWorth,
  serializeAccountWithBalance,
  serializeNetWorth,
} from "@/utils/account-balance";
import { ensureDefaultAccountTypes } from "@/utils/account-types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureDefaultAccountTypes(session.userId);

  const accounts = await getAccountBalances(session.userId);
  const summary = calculateNetWorth(accounts);

  return NextResponse.json({
    accounts: accounts.map(serializeAccountWithBalance),
    summary: serializeNetWorth(summary),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { accountTypeId, name, initialBalance, currency, color, icon, note, tanggalSettlement, tanggalJatuhTempo } = body;

  // Validasi
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Nama akun tidak boleh kosong." }, { status: 400 });
  }
  if (name.trim().length > 50) {
    return NextResponse.json({ error: "Nama akun maksimal 50 karakter." }, { status: 400 });
  }
  if (!accountTypeId) {
    return NextResponse.json({ error: "Tipe akun harus dipilih." }, { status: 400 });
  }

  // Pastikan accountTypeId milik user dan aktif
  const accountType = await prisma.accountType.findUnique({ where: { id: accountTypeId } });
  if (!accountType || accountType.userId !== session.userId || !accountType.isActive) {
    return NextResponse.json({ error: "Tipe akun tidak valid." }, { status: 400 });
  }

  // Validasi Kartu Kredit: wajib ada tanggalSettlement dan tanggalJatuhTempo
  if (accountType.name === "Kartu Kredit") {
    if (!tanggalSettlement || typeof tanggalSettlement !== "number" || tanggalSettlement < 1 || tanggalSettlement > 31) {
      return NextResponse.json({ error: "Tanggal Settlement (1-31) wajib diisi untuk Kartu Kredit." }, { status: 400 });
    }
    if (!tanggalJatuhTempo || typeof tanggalJatuhTempo !== "number" || tanggalJatuhTempo < 1 || tanggalJatuhTempo > 31) {
      return NextResponse.json({ error: "Tanggal Jatuh Tempo (1-31) wajib diisi untuk Kartu Kredit." }, { status: 400 });
    }
  }

  // Parse initialBalance
  let parsedBalance = new Decimal(0);
  if (initialBalance !== undefined && initialBalance !== null && initialBalance !== "") {
    parsedBalance = new Decimal(Number(initialBalance));
    if (!parsedBalance.isFinite() || parsedBalance.isNegative()) {
      return NextResponse.json({ error: "Saldo awal tidak valid." }, { status: 400 });
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  // Create akun + transaksi saldo awal secara atomic
  const account = await prisma.$transaction(async (tx) => {
    const newAccount = await tx.account.create({
      data: {
        userId: session.userId,
        accountTypeId,
        name: name.trim(),
        initialBalance: parsedBalance,
        currency: currency ?? "IDR",
        color: color ?? null,
        icon: icon ?? null,
        note: note ?? "",
        // Kartu Kredit fields
        ...(accountType.name === "Kartu Kredit" && {
          tanggalSettlement,
          tanggalJatuhTempo,
        }),
      },
    });

    // Insert transaksi saldo awal jika > 0
    if (parsedBalance.greaterThan(0)) {
      await tx.transaction.create({
        data: {
          userId: session.userId,
          accountId: newAccount.id,
          type: "income",
          amount: parsedBalance,
          category: "Saldo Awal",
          date: today,
          note: `Saldo awal akun ${newAccount.name}`,
          isInitialBalance: true,
        },
      });
    }

    return newAccount;
  });

  return NextResponse.json({ account }, { status: 201 });
}
