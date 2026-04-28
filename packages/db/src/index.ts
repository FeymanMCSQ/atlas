import 'dotenv/config';
import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

/**
 * Instantiate a single instance of PrismaClient and cache it globally
 * to prevent exhausting database connections during dev hot-reloads.
 */
const globalForPrisma = globalThis as unknown as { prisma: any };

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn("[DB] ⚠️ DATABASE_URL is not set. Prisma will fail if used.");
} else {
  console.log(`[DB] initializing client (Accelerate: ${databaseUrl.startsWith('prisma://')})`);
}

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    // With Prisma 7 + Accelerate, the URL must be passed directly to the client
    // instead of being read from schema.prisma.
    accelerateUrl: databaseUrl,
  }).$extends(withAccelerate());

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

// Re-export specific types if needed by other packages
export * from "@prisma/client";
