import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const results = { success: 0, skipped: 0, errors: [] as string[] };

  try {
    const installments = await prisma.recurringTransaction.findMany({
      where: {
        installmentTotal: { not: null },
        installmentTenor: { not: null },
        toAccountId: { not: null },
      },
      include: {
        account: { select: { id: true, name: true } },
        toAccount: { select: { id: true, name: true } },
      },
    });

    console.log(`[INFO] Found ${installments.length} cicilan transfer records\n`);

    if (installments.length === 0) {
      console.log("[DONE] No cicilan transfer records found. Nothing to fix.");
      return;
    }

    for (const r of installments) {
      const startDate = r.startDate.toISOString().slice(0, 10);
      const categoryLabel = `[Cicilan] ${r.name}`;
      const noteLabel = `[installment:${r.id}] Cicilan ${r.name}`;
      const monthlyAmount = r.amount;
      const sharedTransferId = `cicilan-${r.id}-initial`;

      console.log(`[CHECK] ${r.name} | From: ${r.account?.name} | To: ${r.toAccount?.name} | Start: ${startDate}`);

      // Check if initial transaction exists in Prisma
      const existingTx = await prisma.transaction.findFirst({
        where: {
          userId: r.userId,
          date: startDate,
          note: noteLabel,
        },
      });

      if (existingTx) {
        console.log(`  [SKIP] Prisma tx already exists (id: ${existingTx.id}, type: ${existingTx.type})\n`);
        results.skipped++;
        continue;
      }

      // Create initial transfer_out + transfer_in
      try {
        await prisma.$transaction([
          prisma.transaction.create({
            data: {
              userId: r.userId, date: startDate, amount: monthlyAmount,
              category: categoryLabel, note: noteLabel,
              type: "transfer_out", accountId: r.accountId!, transferId: sharedTransferId,
            },
          }),
          prisma.transaction.create({
            data: {
              userId: r.userId, date: startDate, amount: monthlyAmount,
              category: categoryLabel, note: noteLabel,
              type: "transfer_in", accountId: r.toAccountId!, transferId: sharedTransferId,
            },
          }),
        ]);
        console.log(`  [OK] Created Prisma transfer pair (${sharedTransferId})`);
        results.success++;
      } catch (err: any) {
        console.error(`  [ERROR] Failed to create Prisma tx: ${err.message}`);
        results.errors.push(`${r.name}: ${err.message}`);
      }

      console.log();
    }

    console.log("=== SUMMARY ===");
    console.log(`Created: ${results.success}`);
    console.log(`Skipped (already exists): ${results.skipped}`);
    console.log(`Errors: ${results.errors.length}`);
    if (results.errors.length > 0) {
      results.errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    }
  } catch (err: any) {
    console.error(`[FATAL] ${err.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
