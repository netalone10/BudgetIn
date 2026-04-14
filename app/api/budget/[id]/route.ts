import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const budget = await prisma.budget.findUnique({ where: { id } });

    if (!budget || budget.userId !== session.userId) {
      return NextResponse.json({ error: "Budget tidak ditemukan" }, { status: 404 });
    }

    await prisma.budget.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Gagal hapus budget. Coba lagi." }, { status: 500 });
  }
}
