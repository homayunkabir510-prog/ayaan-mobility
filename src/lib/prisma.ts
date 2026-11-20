import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const DEFAULT_POOL_MAX = 5;

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL must be configured before using the database.");

  const configuredMax = Number(process.env.DATABASE_POOL_MAX ?? DEFAULT_POOL_MAX);
  if (!Number.isInteger(configuredMax) || configuredMax < 1 || configuredMax > 50) {
    throw new Error("DATABASE_POOL_MAX must be an integer between 1 and 50.");
  }

  const adapter = new PrismaPg({
    connectionString,
    max: configuredMax,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 300_000,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
