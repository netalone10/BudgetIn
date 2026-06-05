import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { blockDemoResponse } from "@/lib/demo-account";
import { sanitizeErrorForProduction } from "@/lib/api-error";
import { validateGoal } from "../route";

export function checkOwnership(goalUserId: string, requestUserId: string): boolean {
  return goalUserId === requestUserId;
}

// ── PATCH — update an existing savings goal ───────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ goalId: string }> }
) {
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { goalId } = await params;
  const body = await req.json();
  const { name, targetAmount, deadline } = body as {
    name: string;
    targetAmount: number;
    deadline?: string | null;
  };

  const validation = validateGoal({ name, targetAmount });
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const goal = await prisma.savingsGoal.update({
      where: { id: goalId, userId: session.userId },
      data: {
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
        targetAmount: Number(goal.targetAmount),
        deadline: goal.deadline ? goal.deadline.toISOString() : null,
        createdAt: goal.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Goal tidak ditemukan" }, { status: 404 });
    }
    const apiError = sanitizeErrorForProduction(error, "internal");
    return NextResponse.json(
      { error: apiError.error, code: apiError.code },
      { status: apiError.statusCode }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ goalId: string }> }
) {
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { goalId } = await params;

  try {
    await prisma.savingsGoal.delete({
      where: { id: goalId, userId: session.userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Goal tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ error: "Gagal menghapus. Coba lagi." }, { status: 500 });
  }
}
