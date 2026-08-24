import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createEventToken, verifyEventToken } from "@/lib/event-token";

const SECRET = "unit-test-secret-1234567890-abcdefghijklmnop";

describe("Event-Tokens", () => {
  it("signiert und verifiziert korrekt (Round-Trip)", async () => {
    const eventId = randomUUID();
    const token = await createEventToken(eventId, SECRET);
    const verified = await verifyEventToken(token, SECRET);
    expect(verified).toBe(eventId);
  });

  it("lehnt manipulierte Tokens ab", async () => {
    const eventId = randomUUID();
    const token = await createEventToken(eventId, SECRET);
    const [id, exp, sig] = token.split(".") as [string, string, string];

    // Manipulierte Event-ID (Kenntnis einer fremden ID reicht nicht)
    const otherId = randomUUID();
    expect(await verifyEventToken(`${otherId}.${exp}.${sig}`, SECRET)).toBeNull();
    // Manipulierter Ablauf
    expect(await verifyEventToken(`${id}.${Number(exp) + 99999}.${sig}`, SECRET)).toBeNull();
    // Manipulierte Signatur
    expect(await verifyEventToken(`${id}.${exp}.${sig.slice(0, -2)}xx`, SECRET)).toBeNull();
  });

  it("lehnt Tokens mit falschem Secret ab", async () => {
    const token = await createEventToken(randomUUID(), SECRET);
    expect(await verifyEventToken(token, "anderes-secret-000000000000000000")).toBeNull();
  });

  it("lehnt abgelaufene Tokens ab", async () => {
    const eventId = randomUUID();
    const token = await createEventToken(eventId, SECRET, 1000, Date.now() - 10_000);
    expect(await verifyEventToken(token, SECRET)).toBeNull();
  });

  it("akzeptiert noch gültige Tokens kurz vor Ablauf", async () => {
    const eventId = randomUUID();
    const now = Date.now();
    const token = await createEventToken(eventId, SECRET, 5000, now);
    expect(await verifyEventToken(token, SECRET, now + 4999)).toBe(eventId);
    expect(await verifyEventToken(token, SECRET, now + 5001)).toBeNull();
  });

  it("lehnt fehlerhafte Formate ab", async () => {
    expect(await verifyEventToken("", SECRET)).toBeNull();
    expect(await verifyEventToken("nur-ein-teil", SECRET)).toBeNull();
    expect(await verifyEventToken("a.b", SECRET)).toBeNull();
    expect(await verifyEventToken("a.b.c.d", SECRET)).toBeNull();
    expect(await verifyEventToken("nicht-uuid.123.sig", SECRET)).toBeNull();
    expect(await verifyEventToken("x".repeat(600), SECRET)).toBeNull();
  });
});
