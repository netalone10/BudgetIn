import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  // Fetch goals and contributions in parallel
  const [goals, contributions] = await Promise.all([
    prisma.savingsGoal.findMany({ where: { userId } }),
    prisma.savingsContribution.findMany({
      where: { userId },
      orderBy: { date: "desc" },
    }),
  ]);

  // Build goals with progress
  const goalsWithProgress = goals.map((goal) => {
    const goalContributions = contributions
      .filter((contribution) => contribution.goalId === goal.id)
      .map((contribution) => ({
        id: contribution.transactionId,
        date: contribution.date,
        amount: contribution.amount.toNumber(),
        note: contribution.note,
      }));
    const totalContributed = goalContributions.reduce((sum, contribution) => sum + contribution.amount, 0);

    return {
      id: goal.id,
      userId: goal.userId,
      name: goal.name,
      targetAmount: goal.targetAmount,
      deadline: goal.deadline ? goal.deadline.toISOString() : null,
      createdAt: goal.createdAt.toISOString(),
      totalContributed,
      contributions: goalContributions,
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
