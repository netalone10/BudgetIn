import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resetUserAccountSetup } from "@/lib/account-reset";

const CONFIRMATION = "RESET AKUN";

async function readConfirmation(req: NextRequest) {
  try {
    const body = await req.json();
    return typeof body?.confirmation === "string" ? body.confirmation : "";
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const confirmation = await readConfirmation(req);
  if (confirmation !== CONFIRMATION) {
    return NextResponse.json({ error: `Ketik ${CONFIRMATION} untuk konfirmasi.` }, { status: 400 });
  }

  try {
    const result = await resetUserAccountSetup(session.userId);
    return NextResponse.json({ success: true, result, requiresSignOut: true });
  } catch (error) {
    console.error("[user:reset-account]", error);
    const message = error instanceof Error ? error.message : "Gagal reset akun.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
