import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockDemoResponse } from "@/lib/demo-account";
import { getFamilyContext } from "@/lib/family";

// GET /api/family/savings — goal bersama + progress teragregasi lintas anggota
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getFamilyContext(session.userId);
  if (!ctx) return NextResponse.json({ family: null });

  const goals = await prisma.savingsGoal.findMany({
    where: { familyId: ctx.family.id },
    orderBy: { createdAt: "asc" },
  });

  const goalIds = goals.map((g) => g.id);
  const contributions = goalIds.length
    ? await prisma.savingsContribution.groupBy({
        by: ["goalId", "userId"],
        where: { goalId: { in: goalIds } },
        _sum: { amount: true },
      })
    : [];

  const memberLabel = new Map(
    ctx.members.map((m) => [m.userId, m.displayRole || m.name])
  );

  const result = goals.map((g) => {
    const perMember = contributions
      .filter((c) => c.goalId === g.id)
      .map((c) => ({
        userId: c.userId,
        name: memberLabel.get(c.userId) ?? "Anggota",
        amount: Number(c._sum.amount ?? 0),
      }));
    const totalContributed = perMember.reduce((s, m) => s + m.amount, 0);
    return {
      id: g.id,
      name: g.name,
      targetAmount: Number(g.targetAmount),
      deadline: g.deadline ? g.deadline.toISOString() : null,
      totalContributed,
      perMember,
    };
  });

  return NextResponse.json({ family: { id: ctx.family.id, name: ctx.family.name }, goals: result });
}

// POST /api/family/savings — buat goal bersama (anggota mana pun)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const targetAmount = Number(body.targetAmount);
  const deadline = typeof body.deadline === "string" && body.deadline ? body.deadline : null;

  if (!name || !Number.isFinite(targetAmount) || targetAmount <= 0) {
    return NextResponse.json({ error: "Nama goal dan target wajib diisi" }, { status: 400 });
  }

  const ctx = await getFamilyContext(session.userId);
  if (!ctx) {
    return NextResponse.json({ error: "Kamu tidak tergabung dalam keluarga" }, { status: 404 });
  }

  const goal = await prisma.savingsGoal.create({
    data: {
      userId: session.userId,
      familyId: ctx.family.id,
      name,
      targetAmount,
      deadline: deadline ? new Date(deadline) : null,
    },
  });

  return NextResponse.json({
    goal: { id: goal.id, name: goal.name, targetAmount: Number(goal.targetAmount) },
  });
}
