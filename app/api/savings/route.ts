import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/utils/token";
import { getTransactions } from "@/utils/sheets";
import { getTransactionsDB } from "@/utils/db-transactions";
import { isSavingsTransaction } from "@/lib/savings-utils";

// ── Exported for testability ──────────────────────────────────────────────────

export function validateGoal({
  name,
  targetAmount,
}: {
  name: string;
  targetAmount: number;
}): { valid: boolean; error?: string } {
  if (!name || !name.trim())
    return { valid: false, error: "Nama goal dan target amount wajib diisi" };
  if (!targetAmount || targetAmount <= 0)
    return { valid: false, error: "Nama goal dan target amount wajib diisi" };
  return { valid: true };
}

// ── GET — list all savings goals with contributions ───────────────────────────

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId;

  // Fetch goals and savings categories in parallel
  const [goals, savingsCategories, user] = await Promise.all([
    prisma.savingsGoal.findMany({ where: { userId } }),
    prisma.category.findMany({ where: { userId, isSavings: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { sheetsId: true } }),
  ]);

  const savingsCategoryNames = new Set(
    savingsCategories.map((c) => c.name.toLowerCase())
  );

  // Fetch current month transactions — once, filter in memory
  let transactions: { id: string; date: string; amount: number; category: string; note: string; type: string }[] = [];

  if (user?.sheetsId) {
    // Google Sheets user
    let accessToken: string;
    try {
      accessToken = await getValidToken(userId);
    } catch {
      return NextResponse.json(
        { error: "Sesi expired. Silakan login ulang." },
        { status: 401 }
      );
    }
    const sheetsTxs = await getTransactions(user.sheetsId, accessToken, "bulan ini");
    transactions = sheetsTxs;
    // Google users: keyword matching only — pass empty Set
    savingsCategoryNames.clear();
  } else {
    // Email/DB user
    transactions = await getTransactionsDB(userId, "bulan ini");
  }

  // Build goals with progress
  const goalsWithProgress = goals.map((goal) => {
    const contributions: { id: string; date: string; amount: number; note: string }[] = [];
    let totalContributed = 0;

    for (const tx of transactions) {
      if (tx.type === "income") continue;
      if (isSavingsTransaction(tx.category, savingsCategoryNames)) {
        totalContributed += tx.amount;
        contributions.push({
          id: tx.id,
          date: tx.date,
          amount: tx.amount,
          note: tx.note,
        });
      }
    }

    return {
      id: goal.id,
      userId: goal.userId,
      name: goal.name,
      targetAmount: goal.targetAmount,
      deadline: goal.deadline ? goal.deadline.toISOString() : null,
      createdAt: goal.createdAt.toISOString(),
      totalContributed,
      contributions,
    };
  });

  return NextResponse.json({ goals: goalsWithProgress });
}

// ── POST — create a new savings goal ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, targetAmount, deadline } = body as {
    name: string;
    targetAmount: number;
    deadline?: string;
  };

  const validation = validateGoal({ name, targetAmount });
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const goal = await prisma.savingsGoal.create({
      data: {
        userId: session.userId,
        name: name.trim(),
        targetAmount,
        deadline: deadline ? new Date(deadline) : null,
      },
    });

    return NextResponse.json({
      goal: {
        id: goal.id,
        userId: goal.userId,
        name: goal.name,
        targetAmount: goal.targetAmount,
        deadline: goal.deadline ? goal.deadline.toISOString() : null,
        createdAt: goal.createdAt.toISOString(),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Gagal menyimpan. Coba lagi." },
      { status: 500 }
    );
  }
}
