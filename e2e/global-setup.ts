import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

/**
 * Bereitet die Test-Datenbank vor dem E2E-Lauf vor:
 * Migrationen anwenden (nicht-destruktiv) und alle Tabellen leeren.
 */
export default async function globalSetup(): Promise<void> {
  if (!process.env.DATABASE_URL?.includes("urlshorter_test")) {
    throw new Error(
      "Sicherheitsabbruch: DATABASE_URL zeigt nicht auf die Test-Datenbank (urlshorter_test).",
    );
  }
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: process.env,
  });

  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "ClickEvent", "ShortLink", "Destination", "DailyAggregate", "AuditLog", "AppSetting", "LoginAttempt", "User" CASCADE',
    );
  } finally {
    await prisma.$disconnect();
  }
}
