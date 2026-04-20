import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ categoryId: string }> };

export async function PATCH(
  req: Request,
  { params }: Params
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { categoryId } = await params;
    const body = await req.json();
    const { name, isSavings, rolloverEnabled } = body;

    // Validate: at least one field must be provided
    if (name === undefined && isSavings === undefined && rolloverEnabled === undefined) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
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
    const updateData: { name?: string; isSavings?: boolean; rolloverEnabled?: boolean } = {};
    if (name !== undefined) updateData.name = name.trim();
    if (isSavings !== undefined) updateData.isSavings = isSavings;
    if (rolloverEnabled !== undefined) updateData.rolloverEnabled = rolloverEnabled;

    const category = await prisma.category.update({
      where: { 
        id: categoryId,
        userId: session.userId // memastikan milik user current
      },
      data: updateData,
    });

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
