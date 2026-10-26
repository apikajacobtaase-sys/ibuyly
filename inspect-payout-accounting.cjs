const { PrismaClient } = require("@prisma/client");

const db = new PrismaClient();

async function main() {
  const payoutStatuses = await db.payout.groupBy({
    by: ["status"],
    _count: { _all: true },
    _sum: { amount: true },
  });

  console.log("\n=== EXISTING PAYOUT STATUSES ===");
  console.dir(
    payoutStatuses.map((item) => ({
      status: item.status,
      count: item._count._all,
      totalAmount: Number(item._sum.amount || 0),
    })),
    { depth: null }
  );

  const ledgerTypes = await db.sellerFinancialRecord.groupBy({
    by: ["type"],
    _count: { _all: true },
    _sum: { amount: true },
  });

  console.log("\n=== FINANCIAL LEDGER SUMMARY ===");
  console.dir(
    ledgerTypes.map((item) => ({
      type: item.type,
      count: item._count._all,
      totalAmount: Number(item._sum.amount || 0),
    })),
    { depth: null }
  );
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
