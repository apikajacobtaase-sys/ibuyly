require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.$queryRawUnsafe("SELECT id, migration_name, checksum, started_at, finished_at, rolled_back_at, logs FROM _prisma_migrations ORDER BY started_at").then(rows => console.dir(rows, { depth: null })).catch(console.error).finally(() => p.$disconnect());
