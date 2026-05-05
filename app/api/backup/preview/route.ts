import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createRestorePreview, MAX_BACKUP_BYTES, parseBackupPayload } from "@/lib/backup";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BACKUP_BYTES) {
    return NextResponse.json({ error: "File backup terlalu besar." }, { status: 413 });
  }

  try {
    const payload = await req.json();
    const backup = parseBackupPayload(payload);
    const preview = await createRestorePreview(session.userId, backup);
    return NextResponse.json({ preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "File backup tidak valid.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
