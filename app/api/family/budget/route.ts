import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockDemoResponse } from "@/lib/demo-account";
import { getFamilyContext } from "@/lib/family";
import { getFamilyBudgets } from "@/lib/family-data";
import { getCurrentMonth, isValidMonth } from "@/lib/budget-data";

// GET /api/family/budget?month=YYYY-MM — budget keluarga + realisasi
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const month = req.nextUrl.searchParams.get("month") ?? getCurrentMonth();
  if (!isValidMonth(month)) {
    return NextResponse.json({ error: "month harus format YYYY-MM" }, { status: 400 });
  }

  const data = await getFamilyBudgets(session.userId, month);
  if (!data) return NextResponse.json({ family: null });

  return NextResponse.json(data);
}

// POST /api/family/budget — set/update budget keluarga (anggota mana pun)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const amount = Number(body.amount);
  const month = typeof body.month === "string" && body.month ? body.month : getCurrentMonth();

  if (!category || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "category dan amount wajib diisi" }, { status: 400 });
  }
  if (!isValidMonth(month)) {
    return NextResponse.json({ error: "month harus format YYYY-MM" }, { status: 400 });
  }

  const ctx = await getFamilyContext(session.userId);
  if (!ctx) {
    return NextResponse.json({ error: "Kamu tidak tergabung dalam keluarga" }, { status: 404 });
  }

  const budget = await prisma.familyBudget.upsert({
    where: {
      familyId_category_month: { familyId: ctx.family.id, category, month },
    },
    update: { amount },
    create: { familyId: ctx.family.id, category, month, amount },
  });

  return NextResponse.json({
    budget: { id: budget.id, category: budget.category, amount: Number(budget.amount), month: budget.month },
  });
}

// DELETE /api/family/budget?category=...&month=YYYY-MM
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const category = req.nextUrl.searchParams.get("category") ?? "";
  const month = req.nextUrl.searchParams.get("month") ?? getCurrentMonth();
  if (!category) {
    return NextResponse.json({ error: "category wajib" }, { status: 400 });
  }

  const ctx = await getFamilyContext(session.userId);
  if (!ctx) {
    return NextResponse.json({ error: "Kamu tidak tergabung dalam keluarga" }, { status: 404 });
  }

  await prisma.familyBudget.deleteMany({
    where: { familyId: ctx.family.id, category, month },
  });

  return NextResponse.json({ ok: true });
}
