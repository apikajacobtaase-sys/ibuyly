import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const payouts = await db.payout.findMany({
    where: {
      status: { in: ["PAID", "COMPLETED"] },
    },
    select: {
      id: true,
      sellerId: true,
      amount: true,
      currency: true,
      status: true,
      createdAt: true,
      processedAt: true,
      paymentDetails: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const payoutRecords = await db.sellerFinancialRecord.findMany({
    where: { type: "PAYOUT" },
    select: {
      id: true,
      sellerId: true,
      amount: true,
      currency: true,
      description: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log("\n=== PAYOUT RECONCILIATION (READ ONLY) ===");
  console.log("Paid/completed payout count:", payouts.length);
  console.log("PAYOUT ledger entry count:", payoutRecords.length);

  for (const payout of payouts) {
    const linked = payoutRecords.filter(
      (record) =>
        record.sellerId === payout.sellerId &&
        record.description?.includes(payout.id)
    );

    const amount = Number(payout.amount);

    console.log({
      payoutId: payout.id,
      sellerId: payout.sellerId,
      status: payout.status,
      amount,
      currency: payout.currency,
      createdAt: payout.createdAt,
      processedAt: payout.processedAt,
      paymentDetails: payout.paymentDetails,
      matchingLedgerEntries: linked.length,
      matchingLedgerAmounts: linked.map((record) =>
        Number(record.amount)
      ),
    });
  }

  console.log("\n=== LEDGER ENTRIES WITHOUT A MATCHING PAID PAYOUT ===");

  for (const record of payoutRecords) {
    const matches = payouts.filter(
      (payout) =>
        payout.sellerId === record.sellerId &&
        record.description?.includes(payout.id)
    );

    if (matches.length === 0) {
      console.log({
        ledgerId: record.id,
        sellerId: record.sellerId,
        amount: Number(record.amount),
        currency: record.currency,
        description: record.description,
      });
    }
  }
}

main()
  .catch((error) => {
    console.error("Reconciliation failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });


