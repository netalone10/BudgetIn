import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ typeId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { typeId } = await params;
  const body = await req.json();
  const { name, classification, icon, color, sortOrder } = body;

  // Validasi ownership
  const existing = await prisma.accountType.findUnique({ where: { id: typeId } });
  if (!existing) return NextResponse.json({ error: "Tipe akun tidak ditemukan." }, { status: 404 });
  if (existing.userId !== session.userId) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  // Lock classification jika ada akun aktif yang memakai type ini
  if (classification && classification !== existing.classification) {
    const activeAccountCount = await prisma.account.count({
      where: { accountTypeId: typeId, isActive: true },
    });
    if (activeAccountCount > 0) {
      return NextResponse.json(
        { error: `Tipe ini dipakai ${activeAccountCount} akun aktif. Buat tipe baru untuk klasifikasi berbeda.` },
        { status: 409 }
      );
    }
  }

  // Validasi name jika diubah
  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Nama tidak boleh kosong." }, { status: 400 });
    }
    if (name.trim().length > 30) {
      return NextResponse.json({ error: "Nama maksimal 30 karakter." }, { status: 400 });
    }
  }

  try {
    const updated = await prisma.accountType.update({
      where: { id: typeId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(classification !== undefined && { classification }),
        ...(icon !== undefined && { icon }),
        ...(color !== undefined && { color }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });
    return NextResponse.json({ accountType: updated });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Nama tipe akun sudah digunakan." }, { status: 409 });
    }
    console.error("[PATCH /api/account-types/[typeId]]", error);
    return NextResponse.json({ error: "Gagal mengupdate tipe akun." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { typeId } = await params;
  const { searchParams } = new URL(req.url);
  const soft = searchParams.get("soft") === "true";

  const existing = await prisma.accountType.findUnique({ where: { id: typeId } });
  if (!existing) return NextResponse.json({ error: "Tipe akun tidak ditemukan." }, { status: 404 });
  if (existing.userId !== session.userId) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const accountCount = await prisma.account.count({ where: { accountTypeId: typeId } });

  if (soft) {
    // Soft-delete: type jadi isActive=false, akun tetap aktif
    await prisma.accountType.update({ where: { id: typeId }, data: { isActive: false } });
    return NextResponse.json({ message: "Tipe akun diarsipkan." });
  }

  // Hard-delete: hanya boleh kalau tidak ada akun yang pakai
  if (accountCount > 0) {
    return NextResponse.json(
      { error: `Tipe ini masih dipakai ${accountCount} akun. Hapus atau pindahkan akun tersebut terlebih dahulu, atau arsipkan tipe ini.` },
      { status: 409 }
    );
  }

  await prisma.accountType.delete({ where: { id: typeId } });
  return NextResponse.json({ message: "Tipe akun dihapus." });
}
