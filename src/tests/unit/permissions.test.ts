import { describe, expect, it } from "vitest";
import {
  ALL_ROLES,
  canManageLinks,
  canManageSettings,
  canManageUsers,
  isRole,
} from "@/lib/permissions";

describe("Rollen-Rechte", () => {
  it("Admin darf alles", () => {
    expect(canManageLinks("ADMIN")).toBe(true);
    expect(canManageSettings("ADMIN")).toBe(true);
    expect(canManageUsers("ADMIN")).toBe(true);
  });

  it("Marketer darf Links/Ziele verwalten, aber keine Einstellungen/Benutzer", () => {
    expect(canManageLinks("MARKETER")).toBe(true);
    expect(canManageSettings("MARKETER")).toBe(false);
    expect(canManageUsers("MARKETER")).toBe(false);
  });

  it("Viewer darf nichts verwalten", () => {
    expect(canManageLinks("VIEWER")).toBe(false);
    expect(canManageSettings("VIEWER")).toBe(false);
    expect(canManageUsers("VIEWER")).toBe(false);
  });

  it("isRole validiert nur bekannte Rollen", () => {
    for (const role of ALL_ROLES) expect(isRole(role)).toBe(true);
    expect(isRole("SUPERUSER")).toBe(false);
    expect(isRole(null)).toBe(false);
    expect(isRole(42)).toBe(false);
  });
});
