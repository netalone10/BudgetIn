import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createBudgetInBackup } from "@/lib/backup";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const backup = await createBudgetInBackup(session.userId);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `budgetin-backup-${date}.json`;

    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[backup:export]", error);
    return NextResponse.json({ error: "Gagal membuat backup." }, { status: 500 });
  }
}
