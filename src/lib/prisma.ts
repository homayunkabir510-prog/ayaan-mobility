import { PrismaClient } from "@prisma/client";

// Next.js dev mode hot-reloads modules on every save, which would otherwise
// instantiate a fresh PrismaClient (and a fresh connection pool) on every
// reload. Stashing the instance on `globalThis` survives the reload so we
// reuse the same client and pool. In production, each server instance gets
// exactly one client for its lifetime.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
