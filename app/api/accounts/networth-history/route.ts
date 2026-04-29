import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/utils/token";
import { getTransactions, getAccounts } from "@/utils/sheets";

function endOfMonth(year: number, month: number): string {
  const last = new Date(year, month, 0);
  return `${year}-${String(month).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

function monthLabel(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const months = Math.min(Math.max(parseInt(searchParams.get("months") ?? "6", 10) || 6, 2), 24);

  const now = new Date();
  const targets: { year: number; month: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    targets.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  if (user?.sheetsId) {
    try {
      const accessToken = await getValidToken(session.userId);
      const [sheetsAccounts, allTx] = await Promise.all([
        getAccounts(user.sheetsId, accessToken),
        getTransactions(user.sheetsId, accessToken),
      ]);

      const accountClassification = new Map<string, string>();
      for (const a of sheetsAccounts) {
        accountClassification.set(a.id, a.classification);
      }

      const history = targets.map(({ year, month }) => {
        const endDate = endOfMonth(year, month);
        const relevantTx = allTx.filter((t) => t.date <= endDate);

        const balanceMap = new Map<string, number>();
        for (const t of relevantTx) {
          const acctId = t.type === "income" ? (t.toAccountId ?? t.fromAccountId) : t.fromAccountId;
          if (!acctId) continue;
          const prev = balanceMap.get(acctId) ?? 0;
          if (t.type === "income") {
            balanceMap.set(acctId, prev + t.amount);
          } else {
            balanceMap.set(acctId, prev - t.amount);
          }
        }

        let assets = 0;
        let liabilities = 0;
        for (const [id, bal] of balanceMap) {
          const cls = accountClassification.get(id);
          if (cls === "liability") liabilities += bal;
          else assets += bal;
        }

        return {
          month: monthLabel(year, month),
          netWorth: assets - liabilities,
          assets,
          liabilities,
        };
      });

      return NextResponse.json({ history });
    } catch (e) {
      console.error("networth-history sheets error:", e);
      return NextResponse.json({ error: "Gagal membaca data Sheets" }, { status: 500 });
    }
  }

  const [accounts, allTx] = await Promise.all([
    prisma.account.findMany({
      where: { userId: session.userId, isActive: true },
      include: { accountType: true },
    }),
    prisma.transaction.findMany({
      where: { userId: session.userId, accountId: { not: null } },
      select: { accountId: true, type: true, amount: true, date: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const accountClassification = new Map<string, string>();
  for (const a of accounts) {
    accountClassification.set(a.id, a.accountType.classification);
  }

  const history = targets.map(({ year, month }) => {
    const endDate = endOfMonth(year, month);
    const relevantTx = allTx.filter((t) => t.date <= endDate);

    const balanceMap = new Map<string, number>();
    for (const t of relevantTx) {
      if (!t.accountId) continue;
      const prev = balanceMap.get(t.accountId) ?? 0;
      const amt = Number(t.amount);
      if (t.type === "income" || t.type === "transfer_in") {
        balanceMap.set(t.accountId, prev + amt);
      } else if (t.type === "expense" || t.type === "transfer_out") {
        balanceMap.set(t.accountId, prev - amt);
      }
    }

    let assets = 0;
    let liabilities = 0;
    for (const [id, bal] of balanceMap) {
      const cls = accountClassification.get(id);
      if (cls === "liability") liabilities += bal;
      else assets += bal;
    }

    return {
      month: monthLabel(year, month),
      netWorth: assets - liabilities,
      assets,
      liabilities,
    };
  });

  return NextResponse.json({ history });
}
