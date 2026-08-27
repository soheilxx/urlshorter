import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/session";

const SECRET = "session-test-secret-1234567890-abcdefghij";

describe("Session-Tokens", () => {
  it("signiert und verifiziert korrekt (inkl. Rolle)", async () => {
    const token = await createSessionToken("admin@test.local", "ADMIN", SECRET);
    const payload = await verifySessionToken(token, SECRET);
    expect(payload?.sub).toBe("admin@test.local");
    expect(payload?.role).toBe("ADMIN");
  });

  it("verifiziert alle Rollen", async () => {
    for (const role of ["ADMIN", "MARKETER", "VIEWER"] as const) {
      const token = await createSessionToken("user@test.local", role, SECRET);
      const payload = await verifySessionToken(token, SECRET);
      expect(payload?.role).toBe(role);
    }
  });

  it("lehnt Tokens mit unbekannter Rolle ab", async () => {
    // Token mit ungültiger Rolle bauen (alte Token-Formate ohne/mit falscher
    // Rolle müssen zur erneuten Anmeldung führen).
    const token = await createSessionToken(
      "user@test.local",
      "SUPERUSER" as unknown as "ADMIN",
      SECRET,
    );
    expect(await verifySessionToken(token, SECRET)).toBeNull();
  });

  it("lehnt abgelaufene Sessions ab", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await createSessionToken("admin@test.local", "ADMIN", SECRET, 100, now - 200);
    expect(await verifySessionToken(token, SECRET)).toBeNull();
  });

  it("lehnt manipulierte Tokens und falsche Secrets ab", async () => {
    const token = await createSessionToken("admin@test.local", "ADMIN", SECRET);
    expect(await verifySessionToken(token + "x", SECRET)).toBeNull();
    expect(await verifySessionToken(token, "anderes-secret-9999999999999999999")).toBeNull();
    expect(await verifySessionToken("kaputt", SECRET)).toBeNull();
    expect(await verifySessionToken(null, SECRET)).toBeNull();
    expect(await verifySessionToken(undefined, SECRET)).toBeNull();
  });
});
