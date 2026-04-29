import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { getSingleAccountBalance } from "@/utils/account-balance";
import { getValidToken } from "@/utils/token";
import {
  appendTransaction,
  getAccounts,
  getTransactions,
  computeAccountBalancesFromTx,
} from "@/utils/sheets";

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

  const targetNum = Number(targetBalance);
  if (!Number.isFinite(targetNum)) {
    return NextResponse.json({ error: "Nilai target tidak valid." }, { status: 400 });
  }

  // Cek apakah user pakai Google Sheets
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  // ── SHEETS PATH ────────────────────────────────────────────────────────────
  if (user?.sheetsId) {
    let accessToken: string;
    try {
      accessToken = await getValidToken(session.userId);
    } catch {
      return NextResponse.json({ error: "Sesi expired. Silakan login ulang." }, { status: 401 });
    }

    try {
      const [accounts, transactions] = await Promise.all([
        getAccounts(user.sheetsId, accessToken),
        getTransactions(user.sheetsId, accessToken),
      ]);

      const account = accounts.find((a) => a.id === accountId);
      if (!account) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });

      // Hitung saldo terhitung sekarang dari ledger
      const balances = computeAccountBalancesFromTx(accounts, transactions);
      const current = balances.get(accountId) ?? 0;
      const diff = targetNum - current;

      if (diff === 0) {
        return NextResponse.json({ message: "Saldo sudah sesuai, tidak ada perubahan." });
      }

      // Tentukan tipe transaksi koreksi sesuai prinsip akuntansi:
      //   Asset, diff>0 → income (uang bertambah, to=acc)
      //   Asset, diff<0 → expense (uang berkurang, from=acc)
      //   Liability, diff>0 → expense (utang naik, from=acc)
      //   Liability, diff<0 → income (utang turun, to=acc)
      const isLiability = account.classification === "liability";
      const balanceIncreases = diff > 0;
      const useIncomeRow = isLiability ? !balanceIncreases : balanceIncreases;
      const today = new Date().toISOString().slice(0, 10);

      await appendTransaction(user.sheetsId, accessToken, {
        date: today,
        amount: Math.abs(diff),
        category: "Penyesuaian Saldo",
        note: note ?? "Koreksi saldo manual",
        type: useIncomeRow ? "income" : "expense",
        ...(useIncomeRow
          ? { toAccountId: accountId, toAccountName: account.name }
          : { fromAccountId: accountId, fromAccountName: account.name }),
      });

      return NextResponse.json({
        message: `Saldo disesuaikan ${balanceIncreases ? "naik" : "turun"} Rp ${Math.abs(diff).toLocaleString("id-ID")}.`,
        previousBalance: current.toString(),
        newBalance: targetNum.toString(),
      });
    } catch (e) {
      console.error("Failed to adjust balance in Sheets:", e);
      return NextResponse.json({ error: "Gagal menyesuaikan saldo di Google Sheets." }, { status: 500 });
    }
  }

  // ── DB PATH ────────────────────────────────────────────────────────────────
  const target = new Decimal(targetNum);

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
