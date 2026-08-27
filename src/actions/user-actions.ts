"use server";

// Bewusst KEIN revalidatePath in den zustandsbehafteten Actions: Die
// Kombination useActionState + revalidatePath kann die Action-Antwort im
// Client-Router verwerfen (Submit bleibt dauerhaft "pending", obwohl der
// Server geschrieben hat). Stattdessen stößt das Formular nach Erfolg ein
// router.refresh() an – die Seiten sind force-dynamic, es entsteht kein
// veralteter Cache.

import { hash, compare } from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { EMPTY_USER_STATE, type UserActionState } from "@/actions/action-states";
import { writeAuditLog } from "@/lib/audit";
import { requireRoleOrThrow, requireSessionOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { ALL_ROLES, ROLE_LABELS, type Role } from "@/lib/permissions";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/session";

/**
 * Benutzerverwaltung (nur ADMIN) + eigene Passwort-Änderung (alle Rollen).
 * Schutzregeln:
 *  - Niemand kann sich selbst deaktivieren, löschen oder die eigene Rolle ändern.
 *  - Der letzte aktive Admin kann weder herabgestuft noch deaktiviert/gelöscht
 *    werden, sofern kein Env-Bootstrap-Admin konfiguriert ist.
 *  - Passwort-Reset/-Änderung invalidiert alle bestehenden Sessions des Kontos.
 */

const BCRYPT_ROUNDS = 12;
const PASSWORD_MIN_LENGTH = 12;

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Bitte eine gültige E-Mail-Adresse angeben.")
  .max(200);

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Das Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen haben.`)
  .max(500);

const roleSchema = z.enum(ALL_ROLES, { message: "Ungültige Rolle." });

const optionalName = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

/** Prüft, ob die Env-Variablen einen Bootstrap-Admin bereitstellen. */
function hasEnvBootstrapAdmin(): boolean {
  const env = getEnv();
  return Boolean(env.ADMIN_EMAIL && (env.ADMIN_PASSWORD_HASH ?? env.ADMIN_PASSWORD_HASH_BASE64));
}

/**
 * True, wenn nach der Änderung (Ziel-Benutzer verliert Admin-Rechte bzw. wird
 * deaktiviert/gelöscht) kein aktiver Admin mehr übrig bliebe.
 */
async function wouldRemoveLastAdmin(targetUserId: string): Promise<boolean> {
  if (hasEnvBootstrapAdmin()) return false;
  const otherActiveAdmins = await prisma.user.count({
    where: { role: "ADMIN", active: true, NOT: { id: targetUserId } },
  });
  return otherActiveAdmins === 0;
}

export async function createUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    const session = await requireRoleOrThrow("ADMIN");
    const parsed = z
      .object({
        email: emailSchema,
        name: optionalName,
        role: roleSchema,
        password: passwordSchema,
      })
      .safeParse({
        email: formData.get("email"),
        name: formData.get("name") ?? undefined,
        role: formData.get("role"),
        password: formData.get("password"),
      });
    if (!parsed.success) {
      return { ...EMPTY_USER_STATE, error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return { ...EMPTY_USER_STATE, error: "Für diese E-Mail-Adresse existiert bereits ein Benutzer." };
    }

    const passwordHash = await hash(parsed.data.password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        role: parsed.data.role,
        passwordHash,
      },
    });

    await writeAuditLog({
      actor: session.email,
      action: "user.create",
      entityType: "User",
      entityId: user.id,
      changes: { email: user.email, name: user.name, role: user.role },
    });

    return {
      ...EMPTY_USER_STATE,
      ok: true,
      success: `Benutzer ${user.email} (${ROLE_LABELS[user.role as Role]}) wurde angelegt.`,
    };
  } catch (error) {
    return {
      ...EMPTY_USER_STATE,
      error: error instanceof Error ? error.message : "Unbekannter Fehler.",
    };
  }
}

export async function updateUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    const session = await requireRoleOrThrow("ADMIN");
    const parsed = z
      .object({
        id: z.string().min(1).max(64),
        name: optionalName,
        role: roleSchema,
        active: z.enum(["true", "false"]).transform((v) => v === "true"),
      })
      .safeParse({
        id: formData.get("id"),
        name: formData.get("name") ?? undefined,
        role: formData.get("role"),
        active: formData.get("active") ?? "false",
      });
    if (!parsed.success) {
      return { ...EMPTY_USER_STATE, error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
    }

    const user = await prisma.user.findUnique({ where: { id: parsed.data.id } });
    if (!user) {
      return { ...EMPTY_USER_STATE, error: "Der Benutzer wurde nicht gefunden." };
    }

    const isSelf = session.userId === user.id;
    if (isSelf && (parsed.data.role !== user.role || !parsed.data.active)) {
      return {
        ...EMPTY_USER_STATE,
        error: "Die eigene Rolle kann nicht geändert und das eigene Konto nicht deaktiviert werden.",
      };
    }

    const losesAdmin =
      user.role === "ADMIN" && (parsed.data.role !== "ADMIN" || !parsed.data.active);
    if (losesAdmin && user.active && (await wouldRemoveLastAdmin(user.id))) {
      return {
        ...EMPTY_USER_STATE,
        error: "Der letzte aktive Admin kann nicht herabgestuft oder deaktiviert werden.",
      };
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: parsed.data.name,
        role: parsed.data.role,
        active: parsed.data.active,
        // Deaktivierung wirkt sofort (getSession prüft active); zusätzlich
        // werden bestehende Sessions bei Reaktivierung nicht wiederbelebt.
        ...(user.active && !parsed.data.active ? { sessionsValidFrom: new Date() } : {}),
      },
    });

    await writeAuditLog({
      actor: session.email,
      action: "user.update",
      entityType: "User",
      entityId: updated.id,
      changes: {
        email: updated.email,
        name: { from: user.name, to: updated.name },
        role: { from: user.role, to: updated.role },
        active: { from: user.active, to: updated.active },
      },
    });

    return {
      ...EMPTY_USER_STATE,
      ok: true,
      success: `Benutzer ${updated.email} wurde aktualisiert.`,
    };
  } catch (error) {
    return {
      ...EMPTY_USER_STATE,
      error: error instanceof Error ? error.message : "Unbekannter Fehler.",
    };
  }
}

export async function resetUserPasswordAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    const session = await requireRoleOrThrow("ADMIN");
    const parsed = z
      .object({ id: z.string().min(1).max(64), password: passwordSchema })
      .safeParse({ id: formData.get("id"), password: formData.get("password") });
    if (!parsed.success) {
      return { ...EMPTY_USER_STATE, error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
    }

    const user = await prisma.user.findUnique({ where: { id: parsed.data.id } });
    if (!user) {
      return { ...EMPTY_USER_STATE, error: "Der Benutzer wurde nicht gefunden." };
    }

    const passwordHash = await hash(parsed.data.password, BCRYPT_ROUNDS);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, sessionsValidFrom: new Date() },
    });

    await writeAuditLog({
      actor: session.email,
      action: "user.reset_password",
      entityType: "User",
      entityId: user.id,
      changes: { email: user.email },
    });

    return {
      ...EMPTY_USER_STATE,
      ok: true,
      success: `Das Passwort von ${user.email} wurde neu gesetzt. Bestehende Sitzungen wurden abgemeldet.`,
    };
  } catch (error) {
    return {
      ...EMPTY_USER_STATE,
      error: error instanceof Error ? error.message : "Unbekannter Fehler.",
    };
  }
}

export async function deleteUserAction(formData: FormData): Promise<void> {
  const session = await requireRoleOrThrow("ADMIN");
  const id = z.string().min(1).max(64).parse(formData.get("id"));

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) redirect("/admin/users");

  if (session.userId === user.id) {
    throw new Error("Das eigene Konto kann nicht gelöscht werden.");
  }
  if (user.role === "ADMIN" && user.active && (await wouldRemoveLastAdmin(user.id))) {
    throw new Error("Der letzte aktive Admin kann nicht gelöscht werden.");
  }

  await prisma.user.delete({ where: { id: user.id } });

  await writeAuditLog({
    actor: session.email,
    action: "user.delete",
    entityType: "User",
    entityId: user.id,
    changes: { email: user.email, role: user.role },
  });

  // Kein revalidatePath nötig: /admin/users ist force-dynamic und der
  // Redirect erzwingt ohnehin ein frisches Rendering.
  redirect("/admin/users");
}

export async function changeOwnPasswordAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    const session = await requireSessionOrThrow();
    if (!session.userId) {
      return {
        ...EMPTY_USER_STATE,
        error:
          "Der Bootstrap-Admin wird über die Environment Variables verwaltet (ADMIN_PASSWORD_HASH_BASE64). Lege dir unter Benutzer ein eigenes Admin-Konto an.",
      };
    }

    const parsed = z
      .object({ currentPassword: z.string().min(1, "Bitte das aktuelle Passwort angeben.").max(500), password: passwordSchema })
      .safeParse({
        currentPassword: formData.get("currentPassword"),
        password: formData.get("password"),
      });
    if (!parsed.success) {
      return { ...EMPTY_USER_STATE, error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || !user.active) {
      return { ...EMPTY_USER_STATE, error: "Nicht autorisiert. Bitte erneut anmelden." };
    }

    const matches = await compare(parsed.data.currentPassword, user.passwordHash);
    if (!matches) {
      return { ...EMPTY_USER_STATE, error: "Das aktuelle Passwort ist falsch." };
    }

    // Andere Sitzungen invalidieren, die eigene nahtlos erneuern:
    // sessionsValidFrom auf volle Sekunde setzen und den neuen Token mit
    // exakt derselben Sekunde ausstellen (iat*1000 == validFrom → gültig).
    const nowSeconds = Math.floor(Date.now() / 1000);
    const passwordHash = await hash(parsed.data.password, BCRYPT_ROUNDS);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, sessionsValidFrom: new Date(nowSeconds * 1000) },
    });

    const env = getEnv();
    if (env.AUTH_SECRET && env.AUTH_SECRET.length >= 32) {
      const token = await createSessionToken(
        user.email,
        user.role,
        env.AUTH_SECRET,
        SESSION_MAX_AGE_SECONDS,
        nowSeconds,
      );
      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: env.PUBLIC_BASE_URL.startsWith("https://"),
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE_SECONDS,
      });
    }

    await writeAuditLog({
      actor: session.email,
      action: "user.change_own_password",
      entityType: "User",
      entityId: user.id,
      changes: { email: user.email },
    });

    return {
      ...EMPTY_USER_STATE,
      ok: true,
      success: "Dein Passwort wurde geändert. Andere Sitzungen wurden abgemeldet.",
    };
  } catch (error) {
    return {
      ...EMPTY_USER_STATE,
      error: error instanceof Error ? error.message : "Unbekannter Fehler.",
    };
  }
}
