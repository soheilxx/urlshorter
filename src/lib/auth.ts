import "server-only";
import { compare } from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthEnv, getEnv, requireAppSecret } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getClientIp } from "@/lib/request-info";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  verifySessionToken,
} from "@/lib/session";
import { computeRateLimitIdentifier } from "@/lib/visitor-hash";

/**
 * Serverseitige Authentifizierung des Single-Admin-Zugangs.
 * - Passwort ausschließlich als bcrypt-Hash in ADMIN_PASSWORD_HASH
 * - Rate Limiting über die LoginAttempt-Tabelle (HMAC-Kennung, keine IPs)
 * - Session als HMAC-signierter, HTTP-only Cookie
 */

const MAX_FAILED_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export type LoginResult = { ok: true } | { ok: false; error: string };

async function getRateLimitIdentifier(): Promise<string> {
  const h = await headers();
  return computeRateLimitIdentifier({
    secret: requireAppSecret(),
    ip: getClientIp(h),
    userAgent: h.get("user-agent"),
  });
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const authEnv = getAuthEnv();
  if (!authEnv.ok) {
    return {
      ok: false,
      error: `Der Admin-Zugang ist nicht konfiguriert. Fehlende Environment Variables: ${authEnv.missing.join(", ")}.`,
    };
  }

  const identifier = await getRateLimitIdentifier();
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const failedAttempts = await prisma.loginAttempt.count({
    where: { identifier, success: false, ts: { gte: windowStart } },
  });
  if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
    logger.warn("login.rate_limited", { identifier });
    return {
      ok: false,
      error: "Zu viele fehlgeschlagene Loginversuche. Bitte in 15 Minuten erneut versuchen.",
    };
  }

  const emailMatches = email.trim().toLowerCase() === authEnv.auth.adminEmail.trim().toLowerCase();
  // bcrypt-Vergleich immer ausführen (kein Timing-Unterschied zwischen
  // "E-Mail falsch" und "Passwort falsch")
  const passwordMatches = await compare(password, authEnv.auth.adminPasswordHash);

  const success = emailMatches && passwordMatches;
  await prisma.loginAttempt.create({ data: { identifier, success } });

  if (!success) {
    logger.warn("login.failed", { identifier });
    return { ok: false, error: "E-Mail-Adresse oder Passwort ist falsch." };
  }

  const token = await createSessionToken(authEnv.auth.adminEmail, authEnv.auth.authSecret);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    // Secure, sobald die Anwendung über HTTPS läuft (Produktion). Lokale
    // Entwicklung und Tests laufen über http://localhost bzw. 127.0.0.1.
    secure: getEnv().PUBLIC_BASE_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  logger.info("login.success", {});
  return { ok: true };
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  logger.info("logout", {});
}

export interface AdminSession {
  email: string;
}

/** Gibt die aktuelle Admin-Session zurück oder null. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const authEnv = getAuthEnv();
  if (!authEnv.ok) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const payload = await verifySessionToken(token, authEnv.auth.authSecret);
  if (!payload) return null;
  // Nur die konfigurierte Admin-E-Mail ist gültig (Secret-Rotation deckt Rest ab)
  if (payload.sub.toLowerCase() !== authEnv.auth.adminEmail.toLowerCase()) return null;
  return { email: payload.sub };
}

/**
 * Zugriffsschutz für Admin-Seiten (Server Components):
 * leitet ohne gültige Session zur Login-Seite um.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

/**
 * Zugriffsschutz für Server Actions und Route Handler:
 * wirft bei fehlender Session einen Fehler (kein Redirect).
 */
export async function requireAdminOrThrow(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    throw new Error("Nicht autorisiert. Bitte erneut anmelden.");
  }
  return session;
}
