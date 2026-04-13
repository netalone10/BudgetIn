import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { seedDefaultCategories, ALL_DEFAULT_CATEGORIES } from "@/utils/seed-categories";

// GET /api/categories — semua kategori milik user + default jika belum ada
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let categories = await prisma.category.findMany({
    where: { userId: session.userId },
    select: { id: true, name: true, type: true, isSavings: true },
    orderBy: { name: "asc" },
  });

  // Kalau user lama belum punya default categories — seed sekarang
  const names = new Set(categories.map((c) => c.name));
  const missingDefaults = ALL_DEFAULT_CATEGORIES.filter((n) => !names.has(n));
  if (missingDefaults.length > 0) {
    await seedDefaultCategories(session.userId);
    // Refetch setelah seed
    categories = await prisma.category.findMany({
      where: { userId: session.userId },
      select: { id: true, name: true, type: true, isSavings: true },
      orderBy: { name: "asc" },
    });
  }

  return NextResponse.json({ categories });
}

// POST /api/categories — create new category
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, type } = await req.json();

    if (!name || (type !== "expense" && type !== "income")) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    // Check existing
    const existing = await prisma.category.findUnique({
      where: {
        userId_name: {
          userId: session.userId,
          name: name.trim(),
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Kategori sudah ada" }, { status: 400 });
    }

    const category = await prisma.category.create({
      data: {
        userId: session.userId,
        name: name.trim(),
        type,
      },
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}
