import "server-only";
import { compare } from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthEnv, getEnv, requireAppSecret } from "@/lib/env";
import { logger } from "@/lib/logger";
import { type Role } from "@/lib/permissions";
import { getClientIp } from "@/lib/request-info";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  verifySessionToken,
} from "@/lib/session";
import { computeRateLimitIdentifier } from "@/lib/visitor-hash";

/**
 * Serverseitige Authentifizierung mit Datenbank-Benutzern und Rollen.
 * - Benutzer liegen in der User-Tabelle (bcrypt-Hash, Rolle, aktiv-Flag).
 * - Der Env-Admin (ADMIN_EMAIL/ADMIN_PASSWORD_HASH) bleibt als
 *   Bootstrap-Zugang bestehen, solange KEIN Datenbank-Benutzer mit derselben
 *   E-Mail existiert (damit ist die erste Anmeldung ohne DB-Benutzer möglich).
 * - Rate Limiting über die LoginAttempt-Tabelle (HMAC-Kennung, keine IPs)
 * - Session als HMAC-signierter, HTTP-only Cookie; die Rolle wird bei jedem
 *   Zugriff frisch aus der Datenbank gelesen (sofortige Wirkung von
 *   Rollenwechsel/Deaktivierung).
 */

const MAX_FAILED_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Statischer bcrypt-Hash (von "urlshorter-dummy-timing-equalizer"): sorgt
 * dafür, dass der Passwortvergleich auch bei unbekannter E-Mail-Adresse
 * gleich lange dauert (kein User-Enumeration-Timing).
 */
const DUMMY_HASH = "$2a$12$q5UlE3F/XldKz2/bxwAqe.SUb6IwcFZOvKPUCB58s3l8gM8e3rajm";

export type LoginResult = { ok: true } | { ok: false; error: string };

export interface DashboardSession {
  email: string;
  role: Role;
  /** null = Bootstrap-Admin aus den Environment Variables (kein DB-Benutzer) */
  userId: string | null;
  name: string | null;
}

function getAuthSecret(): string | null {
  const secret = getEnv().AUTH_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

async function getRateLimitIdentifier(): Promise<string> {
  const h = await headers();
  return computeRateLimitIdentifier({
    secret: requireAppSecret(),
    ip: getClientIp(h),
    userAgent: h.get("user-agent"),
  });
}

/**
 * Zustand der Login-Konfiguration für die Login-Seite:
 * Anmeldung ist möglich, sobald AUTH_SECRET gesetzt ist und mindestens ein
 * Zugang existiert (Env-Admin oder aktiver Datenbank-Benutzer).
 */
export async function getLoginConfigState(): Promise<
  { ok: true } | { ok: false; missing: string[] }
> {
  const envAuth = getAuthEnv();
  if (envAuth.ok) return { ok: true };

  const secretMissing = getAuthSecret() === null;
  if (!secretMissing) {
    const activeUsers = await prisma.user.count({ where: { active: true } });
    if (activeUsers > 0) return { ok: true };
  }
  return { ok: false, missing: envAuth.missing };
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const authSecret = getAuthSecret();
  if (!authSecret) {
    return {
      ok: false,
      error: "Der Login ist nicht konfiguriert (AUTH_SECRET fehlt oder ist zu kurz).",
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

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  const envAuth = getAuthEnv();
  const envAdminMatches =
    envAuth.ok && normalizedEmail === envAuth.auth.adminEmail.trim().toLowerCase();

  // Genau EIN bcrypt-Vergleich pro Versuch (kein Timing-Unterschied zwischen
  // "E-Mail unbekannt", "Benutzer inaktiv" und "Passwort falsch").
  let compareAgainst = DUMMY_HASH;
  if (user?.active) {
    compareAgainst = user.passwordHash;
  } else if (!user && envAdminMatches && envAuth.ok) {
    compareAgainst = envAuth.auth.adminPasswordHash;
  }
  const passwordMatches = await compare(password, compareAgainst);

  let session: { email: string; role: Role } | null = null;
  if (passwordMatches) {
    if (user?.active) {
      session = { email: user.email, role: user.role };
    } else if (!user && envAdminMatches) {
      session = { email: normalizedEmail, role: "ADMIN" };
    }
  }

  await prisma.loginAttempt.create({ data: { identifier, success: session !== null } });

  if (!session) {
    logger.warn("login.failed", { identifier });
    return { ok: false, error: "E-Mail-Adresse oder Passwort ist falsch." };
  }

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
  }

  const token = await createSessionToken(session.email, session.role, authSecret);
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

  logger.info("login.success", { role: session.role });
  return { ok: true };
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  logger.info("logout", {});
}

/**
 * Gibt die aktuelle Session zurück oder null. Rolle und Status werden bei
 * jedem Aufruf frisch aus der Datenbank gelesen; der Env-Admin ist nur
 * gültig, solange kein Datenbank-Benutzer mit derselben E-Mail existiert.
 */
export async function getSession(): Promise<DashboardSession | null> {
  const authSecret = getAuthSecret();
  if (!authSecret) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const payload = await verifySessionToken(token, authSecret);
  if (!payload) return null;

  const normalizedEmail = payload.sub.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (user) {
    if (!user.active) return null;
    // Passwort-Reset/-Änderung macht ältere Sessions sofort ungültig.
    if (user.sessionsValidFrom && payload.iat * 1000 < user.sessionsValidFrom.getTime()) {
      return null;
    }
    return { email: user.email, role: user.role, userId: user.id, name: user.name };
  }

  const envAuth = getAuthEnv();
  if (envAuth.ok && normalizedEmail === envAuth.auth.adminEmail.trim().toLowerCase()) {
    return { email: envAuth.auth.adminEmail, role: "ADMIN", userId: null, name: null };
  }
  return null;
}

/**
 * Zugriffsschutz für Seiten (Server Components):
 * leitet ohne gültige Session zur Login-Seite um.
 */
export async function requireSession(): Promise<DashboardSession> {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session;
}

/**
 * Zugriffsschutz für Seiten mit Rollenbeschränkung:
 * ohne Session → Login; mit Session, aber falscher Rolle → Übersicht.
 */
export async function requireRole(...roles: Role[]): Promise<DashboardSession> {
  const session = await requireSession();
  if (!roles.includes(session.role)) redirect("/admin");
  return session;
}

/**
 * Zugriffsschutz für Server Actions und Route Handler:
 * wirft bei fehlender Session einen Fehler (kein Redirect).
 */
export async function requireSessionOrThrow(): Promise<DashboardSession> {
  const session = await getSession();
  if (!session) {
    throw new Error("Nicht autorisiert. Bitte erneut anmelden.");
  }
  return session;
}

/** Wie requireSessionOrThrow, zusätzlich mit Rollenprüfung. */
export async function requireRoleOrThrow(...roles: Role[]): Promise<DashboardSession> {
  const session = await requireSessionOrThrow();
  if (!roles.includes(session.role)) {
    throw new Error("Keine Berechtigung für diese Aktion.");
  }
  return session;
}
