import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createGoogleSetupMigrationPreview,
  migrateGoogleSetupFallbackToSheets,
} from "@/lib/backup";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const preview = await createGoogleSetupMigrationPreview(session.userId);
    return NextResponse.json({ preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memuat preview migrasi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const preview = await migrateGoogleSetupFallbackToSheets(session.userId);
    return NextResponse.json({ success: true, preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menjalankan migrasi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
