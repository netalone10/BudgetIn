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
    select: { id: true, name: true },
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
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  return NextResponse.json({ categories });
}
