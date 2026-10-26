import { Prisma, PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const verifiedPayouts = [
  {
    id: "cmvlb2iwt000tthrsivcgp60a",
    reference: "645376989695",
  },
  {
    id: "cmvldfz470001thog17nmfmiv",
    reference: "9878756664363",
  },
  {
    id: "cmvle82ln0001thy0gp20el3i",
    reference: "4567234828",
  },
];

async function main() {
  const apply = process.argv.includes("--apply");

  console.log(
    apply
      ? "APPLY MODE: missing ledger entries may be created."
      : "DRY RUN: no database changes will be made."
  );

  if (!apply) {
    for (const item of verifiedPayouts) {
      const payout = await db.payout.findUnique({
        where: { id: item.id },
        select: {
          id: true,
          sellerId: true,
          amount: true,
          currency: true,
          status: true,
          paymentDetails: true,
        },
      });

      if (!payout) {
        throw new Error(`Payout not found: ${item.id}`);
      }

      const details = payout.paymentDetails as Record<string, unknown> | null;

      if (
        payout.status !== "PAID" ||
        details?.paymentReference !== item.reference ||
        payout.currency !== "GHS"
      ) {
        throw new Error(
          `Verification failed for ${item.id}; no changes made.`
        );
      }

      const existing = await db.sellerFinancialRecord.findMany({
        where: {
          sellerId: payout.sellerId,
          type: "PAYOUT",
          description: { contains: payout.id },
        },
        select: { id: true, amount: true, description: true },
      });

      console.log({
        payoutId: payout.id,
        amountGHS: Number(payout.amount),
        status: payout.status,
        referenceMatches: true,
        existingLedgerEntries: existing.length,
        action: existing.length === 0 ? "WOULD CREATE" : "REVIEW EXISTING",
      });
    }

    console.log("\nDry run complete. No database changes were made.");
    console.log("Review the output before using --apply.");
    return;
  }

  await db.$transaction(
    async (tx) => {
      for (const item of verifiedPayouts) {
        await tx.$queryRaw`
          SELECT id FROM payouts WHERE id = ${item.id} FOR UPDATE
        `;

        const payout = await tx.payout.findUnique({
          where: { id: item.id },
          select: {
            id: true,
            sellerId: true,
            amount: true,
            currency: true,
            status: true,
            paymentDetails: true,
          },
        });

        if (!payout) {
          throw new Error(`Payout not found: ${item.id}`);
        }

        const details = payout.paymentDetails as Record<string, unknown> | null;

        if (
          payout.status !== "PAID" ||
          details?.paymentReference !== item.reference ||
          payout.currency !== "GHS"
        ) {
          throw new Error(
            `Verification failed for ${item.id}; transaction rolled back.`
          );
        }

        const existing = await tx.sellerFinancialRecord.findMany({
          where: {
            sellerId: payout.sellerId,
            type: "PAYOUT",
            description: { contains: payout.id },
          },
          select: { id: true },
        });

        if (existing.length > 1) {
          throw new Error(
            `Multiple matching ledger entries for ${item.id}; transaction rolled back.`
          );
        }

        if (existing.length === 1) {
          console.log(`Already recorded; skipping ${item.id}`);
          continue;
        }

        await tx.sellerFinancialRecord.create({
          data: {
            sellerId: payout.sellerId,
            type: "PAYOUT",
            amount: new Prisma.Decimal(payout.amount).negated(),
            currency: payout.currency,
            description:
              `Verified payout ${payout.id}; reference: ${item.reference}`,
          },
        });

        console.log(`Created ledger entry for ${item.id}`);
      }
    },
    { maxWait: 10000, timeout: 30000 }
  );

  console.log("\nPayout ledger repair completed.");
}

main()
  .catch((error) => {
    console.error("Repair failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
