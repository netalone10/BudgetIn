import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { addDays, startOfDay } from "date-fns";
import { sendRecurringReminderEmail, sendAutoRecordConfirmation } from "@/lib/email";
import { runRecurringOccurrence } from "@/utils/recurring-executor";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const today = startOfDay(new Date());
  const results: {
    remindersSent: number;
    autoRecorded: number;
    skipped: number;
    errors: { recurringId: string; error: string }[];
  } = {
    remindersSent: 0,
    autoRecorded: 0,
    skipped: 0,
    errors: [],
  };

  // ── 1. Reminders ─────────────────────────────────────────────────────────────
  const checkDays = [1, 3, 7, 14];
  const dueDates = checkDays.map((d) => addDays(today, d));

  const itemsToRemind = await prisma.recurringTransaction.findMany({
    where: {
      isActive: true,
      nextDueDate: { in: dueDates },
    },
    include: { user: { select: { email: true, name: true } } },
  });

  for (const item of itemsToRemind) {
    const daysUntil = Math.round(
      (startOfDay(item.nextDueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (!item.reminderDays.includes(daysUntil)) continue;
    if (!item.user.email) continue;
    try {
      await sendRecurringReminderEmail({
        to: item.user.email,
        name: item.name,
        type: item.type as "expense" | "income" | "transfer",
        amount: item.amount.toNumber(),
        dueDate: item.nextDueDate,
        daysUntil,
      });
      results.remindersSent++;
    } catch (err) {
      results.errors.push({ recurringId: item.id, error: String(err) });
    }
  }

  // ── 2. Auto-record ────────────────────────────────────────────────────────────
  // Tangkap item yang jatuh tempo hari ini ATAU sudah lewat (overdue). Tanpa ini,
  // item yang due date-nya terlewat (mis. cron gagal sehari, atau due sebelum
  // di-deploy) tidak pernah tertangkap lagi dan jadi terlantar — tidak pernah
  // tercatat. runRecurringOccurrence mencatat satu occurrence lalu memajukan
  // nextDueDate, jadi aman dari pencatatan ganda.
  const itemsDue = await prisma.recurringTransaction.findMany({
    where: {
      isActive: true,
      nextDueDate: { lt: addDays(today, 1) },
      OR: [{ endDate: null }, { endDate: { gte: today } }],
    },
    select: { id: true, user: { select: { email: true } } },
  });

  for (const { id, user } of itemsDue) {
    try {
      const result = await runRecurringOccurrence(id, today);
      if (!result.ok) {
        results.errors.push({ recurringId: id, error: result.error });
        continue;
      }
      if (result.alreadyRan) {
        results.skipped++;
      } else {
        results.autoRecorded++;
        // Send confirmation email
        if (user.email && result.recurring && result.occurredDay && result.amount) {
          try {
            await sendAutoRecordConfirmation({
              to: user.email,
              name: result.recurring.name,
              type: result.recurring.type as "expense" | "income" | "transfer",
              amount: result.amount.toNumber(),
              occurredAt: result.occurredDay,
            });
          } catch { /* email failure is non-critical */ }
        }
      }
    } catch (err) {
      results.errors.push({ recurringId: id, error: String(err) });
    }
  }

  return Response.json(results);
}
