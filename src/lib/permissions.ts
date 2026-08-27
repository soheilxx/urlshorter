/**
 * Zentrale Rollen- und Rechte-Definition für das Dashboard.
 *
 * - ADMIN:    Vollzugriff inkl. Benutzerverwaltung und Einstellungen
 * - MARKETER: Kurzlinks und Ziele anlegen/bearbeiten, alle Auswertungen
 * - VIEWER:   Nur Lesezugriff (Übersicht, Analytics, Klicks, Listen, Export)
 *
 * Bewusst ohne Prisma-Import, damit die Datei auch in Client-Komponenten
 * (Navigation) und der Edge-Middleware nutzbar ist.
 */

export const ALL_ROLES = ["ADMIN", "MARKETER", "VIEWER"] as const;

export type Role = (typeof ALL_ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  MARKETER: "Marketer",
  VIEWER: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "Vollzugriff inkl. Benutzerverwaltung und Einstellungen",
  MARKETER: "Kurzlinks und Ziele verwalten, alle Auswertungen einsehen",
  VIEWER: "Nur Lesezugriff auf Auswertungen und Listen",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ALL_ROLES as readonly string[]).includes(value);
}

/** Kurzlinks und Ziele anlegen, bearbeiten und (de)aktivieren. */
export function canManageLinks(role: Role): boolean {
  return role === "ADMIN" || role === "MARKETER";
}

/** Anwendungs-Einstellungen ändern. */
export function canManageSettings(role: Role): boolean {
  return role === "ADMIN";
}

/** Benutzer anlegen, bearbeiten und deaktivieren. */
export function canManageUsers(role: Role): boolean {
  return role === "ADMIN";
}
