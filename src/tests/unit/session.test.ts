import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/session";

const SECRET = "session-test-secret-1234567890-abcdefghij";

describe("Session-Tokens", () => {
  it("signiert und verifiziert korrekt", async () => {
    const token = await createSessionToken("admin@test.local", SECRET);
    const payload = await verifySessionToken(token, SECRET);
    expect(payload?.sub).toBe("admin@test.local");
  });

  it("lehnt abgelaufene Sessions ab", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await createSessionToken("admin@test.local", SECRET, 100, now - 200);
    expect(await verifySessionToken(token, SECRET)).toBeNull();
  });

  it("lehnt manipulierte Tokens und falsche Secrets ab", async () => {
    const token = await createSessionToken("admin@test.local", SECRET);
    expect(await verifySessionToken(token + "x", SECRET)).toBeNull();
    expect(await verifySessionToken(token, "anderes-secret-9999999999999999999")).toBeNull();
    expect(await verifySessionToken("kaputt", SECRET)).toBeNull();
    expect(await verifySessionToken(null, SECRET)).toBeNull();
    expect(await verifySessionToken(undefined, SECRET)).toBeNull();
  });
});
