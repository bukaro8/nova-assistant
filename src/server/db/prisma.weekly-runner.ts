import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });

// The production runner uses the Prisma client generated into node_modules.
// Keep this intentionally loose so local stale generated types do not block the
// runner build; the Docker build regenerates @prisma/client before compiling.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prisma = new PrismaClient({ adapter }) as any;
