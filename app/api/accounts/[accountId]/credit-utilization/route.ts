import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSingleAccountBalance } from "@/utils/account-balance";
import { computeCreditUtilization } from "@/lib/installment-utils";

type Params = { params: Promise<{ accountId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accountId } = await params;

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { accountType: true },
  });

  if (!account)
    return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  if (account.userId !== session.userId)
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (account.accountType.name !== "Kartu Kredit")
    return NextResponse.json(
      { error: "Akun ini bukan Kartu Kredit." },
      { status: 400 }
    );

  const balance = await getSingleAccountBalance(session.userId, accountId);
  const currentBalance = Math.abs(balance.toNumber());

  const creditLimitNum = account.creditLimit?.toNumber() ?? null;

  const result = computeCreditUtilization(creditLimitNum, currentBalance);

  return NextResponse.json({
    accountId: account.id,
    accountName: account.name,
    creditLimit: result.creditLimit,
    currentBalance: result.currentBalance,
    availableCredit: result.availableCredit,
    utilizationPercent: result.utilizationPercent,
    warning: result.warning,
    billingCycleDay: account.billingCycleDay,
    tanggalJatuhTempo: account.tanggalJatuhTempo,
    tanggalSettlement: account.tanggalSettlement,
  });
}
