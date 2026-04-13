import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export function checkOwnership(goalUserId: string, requestUserId: string): boolean {
  return goalUserId === requestUserId;
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ goalId: string }> }
) {
  const session = await getServerSession(authOptions);
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
