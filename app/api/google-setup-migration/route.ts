import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createGoogleSetupMigrationPreview,
  markGoogleSetupMigrationComplete,
  migrateGoogleSetupFallbackToSheets,
} from "@/lib/backup";
import { blockDemoResponse } from "@/lib/demo-account";

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

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const preview = body?.action === "mark-complete"
      ? await markGoogleSetupMigrationComplete(session.userId)
      : await migrateGoogleSetupFallbackToSheets(session.userId);
    return NextResponse.json({ success: true, preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menjalankan migrasi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
