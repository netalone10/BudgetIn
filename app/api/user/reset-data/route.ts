import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resetUserFinancialData } from "@/lib/account-reset";
import { blockDemoResponse } from "@/lib/demo-account";

const CONFIRMATION = "RESET DATA";

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
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const confirmation = await readConfirmation(req);
  if (confirmation !== CONFIRMATION) {
    return NextResponse.json({ error: `Ketik ${CONFIRMATION} untuk konfirmasi.` }, { status: 400 });
  }

  try {
    const result = await resetUserFinancialData(session.userId);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[user:reset-data]", error);
    const message = error instanceof Error ? error.message : "Gagal reset data.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
