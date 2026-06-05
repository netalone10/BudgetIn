import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockDemoResponse } from "@/lib/demo-account";
import { type BudgetType } from "@/utils/budget-type";

type Params = { params: Promise<{ categoryId: string }> };

function isMissingBudgetTypeColumnError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const maybeError = error as { code?: string; message?: string; meta?: { column?: string } };
  return (
    maybeError.code === "P2022" &&
    (maybeError.meta?.column === "budget_type" ||
      maybeError.message?.includes("budget_type") ||
      maybeError.message?.includes("Category.budgetType"))
  );
}

export async function PATCH(
  req: Request,
  { params }: Params
) {
  try {
    const session = await getServerSession(authOptions);
    const demoBlock = await blockDemoResponse(session);
    if (demoBlock) return demoBlock;
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { categoryId } = await params;
    const body = await req.json();
    const { name, icon, isSavings, rolloverEnabled, budgetType } = body;

    // Validate: at least one field must be provided
    if (name === undefined && icon === undefined && isSavings === undefined && rolloverEnabled === undefined && budgetType === undefined) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    if (budgetType !== undefined && budgetType !== "fixed" && budgetType !== "variable") {
      return NextResponse.json({ error: "budgetType tidak valid" }, { status: 400 });
    }

    // Name validation only if name is provided
    if (name !== undefined) {
      if (!name || name.trim() === "") {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }

      // Check existing name (untuk user ini) supaya tidak duplikat
      const existing = await prisma.category.findUnique({
        where: {
          userId_name: {
            userId: session.userId,
            name: name.trim(),
          },
        },
      });

      if (existing && existing.id !== categoryId) {
        return NextResponse.json(
          { error: "Kategori dengan nama ini sudah ada" },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: { name?: string; icon?: string | null; isSavings?: boolean; rolloverEnabled?: boolean; budgetType?: BudgetType } = {};
    if (name !== undefined) updateData.name = name.trim();
    if (icon !== undefined) updateData.icon = icon || null; // empty string → null (reset to default)
    if (isSavings !== undefined) updateData.isSavings = isSavings;
    if (rolloverEnabled !== undefined) updateData.rolloverEnabled = rolloverEnabled;
    if (budgetType !== undefined) updateData.budgetType = budgetType;

    let category;
    try {
      category = await prisma.category.update({
        where: {
          id: categoryId,
          userId: session.userId // memastikan milik user current
        },
        data: updateData,
      });
    } catch (error) {
      if (!isMissingBudgetTypeColumnError(error) || budgetType === undefined) throw error;

      const fallbackUpdateData = { ...updateData };
      delete fallbackUpdateData.budgetType;

      if (Object.keys(fallbackUpdateData).length > 0) {
        category = await prisma.category.update({
          where: {
            id: categoryId,
            userId: session.userId // memastikan milik user current
          },
          data: fallbackUpdateData,
        });
      } else {
        category = await prisma.category.findUnique({
          where: {
            id: categoryId,
            userId: session.userId // memastikan milik user current
          },
          select: { id: true, userId: true, name: true, type: true, isSavings: true, rolloverEnabled: true },
        });
      }
    }

    return NextResponse.json({ category });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: Params
) {
  try {
    const session = await getServerSession(authOptions);
    const demoBlock = await blockDemoResponse(session);
    if (demoBlock) return demoBlock;
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { categoryId } = await params;

    await prisma.category.delete({
      where: {
        id: categoryId,
        userId: session.userId, // ensure ownership
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}
