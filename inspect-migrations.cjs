require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
  const rows = await db.$queryRaw`
    SELECT
      migration_name,
      started_at,
      finished_at,
      rolled_back_at
    FROM public."_prisma_migrations"
    ORDER BY started_at
  `;

  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch((error) => {
    console.error("Inspection failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
