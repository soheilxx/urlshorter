import "server-only";
import { PrismaClient } from "@prisma/client";

/**
 * Prisma-Singleton. In der Entwicklung wird der Client über globalThis
 * wiederverwendet (Hot Reload), in Serverless-Produktionsumgebungen erzeugt
 * jede Instanz genau einen Client. Für Vercel wird eine gepoolte
 * DATABASE_URL empfohlen (siehe README).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
