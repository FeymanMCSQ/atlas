import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load environment variables from the root monorepo .env file
dotenv.config({ path: resolve(__dirname, "../../../.env") });

/**
 * Instantiate a single instance of PrismaClient and cache it globally
 * to prevent exhausting database connections during dev hot-reloads.
 */
const globalForPrisma = globalThis as unknown as { prisma: any };

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    // With Prisma 7 + Accelerate, the URL must be passed directly to the client
    // instead of being read from schema.prisma.
    accelerateUrl: process.env.DATABASE_URL,
  }).$extends(withAccelerate());

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

// Re-export specific types if needed by other packages
export * from "@prisma/client";
