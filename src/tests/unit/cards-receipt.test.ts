import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CARDS_RECEIPT_TTL_SECONDS,
  cardsReceiptCookieOptions,
  createCardsReceipt,
  verifyCardsReceipt,
} from "@/lib/cards-receipt";
import { resetEnvCache } from "@/lib/env";

/** Signierter Nachweis der Cards-Bestätigungsseite: Bindung, Ablauf, Manipulation. */

beforeEach(() => {
  vi.stubEnv("APP_SECRET", "s".repeat(64));
  vi.stubEnv("PUBLIC_BASE_URL", "https://lizenzzumerfolg.com");
  resetEnvCache();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});

describe("Cards-Receipt", () => {
  it("trägt Referenz, Ereignis-ID und Vorgangs-Nonce – ohne personenbezogene Daten im Klartext-Cookie", () => {
    const token = createCardsReceipt(
      {
        referenceNumber: "K7M2X9AB",
        trackingEventId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        persisted: true,
      },
      1_760_000_000_000,
    );
    expect(token).not.toContain("K7M2X9AB"); // base64url-kodiert, nicht als Klartext lesbar
    const receipt = verifyCardsReceipt(token, 1_760_000_000_000 + 5_000);
    expect(receipt).toMatchObject({
      campaign: "cards_2026",
      referenceNumber: "K7M2X9AB",
      trackingEventId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      persisted: true,
    });
    expect(receipt?.nonce).toMatch(/^[a-f0-9]{32}$/);
    expect(receipt?.expiresAt).toBe(1_760_000_000_000 + CARDS_RECEIPT_TTL_SECONDS * 1000);
  });

  it("Honeypot-Scheinerfolg erhält nie eine Ereignis-ID (keine Feier, kein Event)", () => {
    const token = createCardsReceipt(
      {
        referenceNumber: "K7M2X9AB",
        trackingEventId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        persisted: false,
      },
      1_760_000_000_000,
    );
    const receipt = verifyCardsReceipt(token, 1_760_000_000_000 + 5_000);
    expect(receipt?.persisted).toBe(false);
    expect(receipt?.trackingEventId).toBeNull();
  });

  it("lehnt abgelaufene, manipulierte und fremde Tokens ab", () => {
    const issued = 1_760_000_000_000;
    const token = createCardsReceipt(
      { referenceNumber: "K7M2X9AB", trackingEventId: null, persisted: true },
      issued,
    );
    expect(verifyCardsReceipt(token, issued + CARDS_RECEIPT_TTL_SECONDS * 1000)).toBeNull();
    const [payload, signature] = token.split(".") as [string, string];
    expect(verifyCardsReceipt(`${payload}x.${signature}`, issued)).toBeNull();
    expect(verifyCardsReceipt(`${payload}.${signature.slice(0, -2)}zz`, issued)).toBeNull();
    expect(verifyCardsReceipt("", issued)).toBeNull();
    expect(verifyCardsReceipt(null, issued)).toBeNull();
    expect(verifyCardsReceipt("nicht.signiert", issued)).toBeNull();
    // Anderes Secret → andere Signatur
    vi.stubEnv("APP_SECRET", "t".repeat(64));
    resetEnvCache();
    expect(verifyCardsReceipt(token, issued)).toBeNull();
  });

  it("jeder Vorgang erhält eine neue Nonce (weitere Bestellnummer darf erneut gefeiert werden)", () => {
    const a = verifyCardsReceipt(
      createCardsReceipt({ referenceNumber: "K7M2X9AB", trackingEventId: null, persisted: true }),
    );
    const b = verifyCardsReceipt(
      createCardsReceipt({ referenceNumber: "K7M2X9AB", trackingEventId: null, persisted: true }),
    );
    expect(a?.nonce).not.toBe(b?.nonce);
  });

  it("Cookie ist httpOnly, kurzlebig, auf /cards/danke begrenzt und in Produktion secure", () => {
    const options = cardsReceiptCookieOptions();
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/cards/danke",
      maxAge: CARDS_RECEIPT_TTL_SECONDS,
    });
    vi.stubEnv("PUBLIC_BASE_URL", "http://127.0.0.1:3100");
    resetEnvCache();
    expect(cardsReceiptCookieOptions().secure).toBe(false);
  });
});
