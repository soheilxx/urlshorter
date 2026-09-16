import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

/**
 * E2E: Kampagnen-Landingpage /verlosung (gemeinsamer Lostopf mit /gewinn).
 * Läuft gegen den Produktions-Build mit .env.test (Consent-Cookie
 * marketing_consent=accepted, Test-Pixel-IDs, echte Test-Datenbank).
 */

const STAMP = Date.now().toString().slice(-7);
const ORDER_A = `306-${STAMP}-1000001`;
const ORDER_B = `TH-${STAMP}-B2`;
const ORDER_HONEYPOT = `306-${STAMP}-9000009`;
const CANONICAL = "https://lizenzzumerfolg.com/verlosung";
const CAMPAIGN_QUERY =
  "?utm_source=adcloud&utm_medium=email&utm_campaign=buch_verlosung_2026&utm_content=angebote_email";

/** Externe Pixel-Skripte blockieren – geprüft wird nur die First-Party-Kette. */
async function blockExternal(page: Page) {
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort(),
  );
}

async function acceptConsent(page: Page) {
  await page.getByRole("button", { name: "Alle akzeptieren" }).click();
  await expect(page.getByTestId("consent-banner")).toHaveCount(0);
}

async function fillEntry(page: Page, orderNumber: string, email: string, retailer = "amazon") {
  await page.getByLabel("Händler", { exact: true }).selectOption(retailer);
  await page.getByLabel("Bestell- / Auftragsnummer").fill(orderNumber);
  await page.getByLabel("Vorname").fill("Erika");
  await page.getByLabel("Nachname").fill("Musterfrau");
  await page.getByLabel("Straße").fill("Musterstraße");
  await page.getByLabel("Hausnummer").fill("12a");
  await page.getByLabel("Postleitzahl").fill("10115");
  await page.getByLabel("Ort").fill("Berlin");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Telefonnummer (mit Ländervorwahl)").fill("+49 151 1234567");
  await page.getByLabel(/Angaben vollständig und korrekt/).check();
}

/** Alle fbq-Aufrufe aus der Pixel-Queue (externe Skripte sind blockiert → Queue bleibt stehen). */
async function fbqCalls(page: Page) {
  return page.evaluate(() => {
    const queue = (window as Window & { fbq?: { queue?: unknown[][] } }).fbq?.queue ?? [];
    return queue.map((entry) => Array.from(entry as unknown[]));
  });
}

test.describe("Kampagnenseite /verlosung", () => {
  test("rendert Hero, Gewinnübersicht, drei Gutscheinkarten, Teilen-URL und Consent-Banner", async ({
    page,
  }) => {
    await page.goto(`/verlosung${CAMPAIGN_QUERY}`);

    await expect(page).toHaveTitle("Dubai-Reise & 300 Gutscheine gewinnen | Die Lizenz zum Erfolg");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", CANONICAL);
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toContainText("Dubai für zwei.");
    await expect(h1).toContainText("300 Gutscheine");
    await expect(page.getByText("Gewinne im Gesamtwert von 54.500 €")).toBeVisible();
    await expect(
      page.getByText(
        "Erst das Buch kaufen, dann die Bestellnummer eintragen. Die Teilnahme erfolgt nicht automatisch.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Jetzt Buch vorbestellen" }).first()).toHaveAttribute(
      "href",
      "#buch-kaufen",
    );
    await expect(
      page.getByRole("link", { name: "Bereits gekauft? Jetzt teilnehmen" }).first(),
    ).toHaveAttribute("href", "#teilnehmen");

    // Los-Regel prominent in der Oberfläche
    await expect(
      page.getByRole("heading", { name: "Jede Bestellnummer zählt als ein Los." }),
    ).toBeVisible();

    // Gutscheinkarten: Reihenfolge, Staffeln, Summen
    const cards = page.getByTestId(/^voucher-card-/);
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toContainText("Wiresoft");
    await expect(cards.nth(1)).toContainText("Bikinilista");
    await expect(cards.nth(2)).toContainText("Amazon");
    await expect(page.getByTestId("voucher-card-wiresoft")).toContainText(
      "100 Gutscheine · Gesamtwert 13.500 €",
    );
    await expect(page.getByTestId("voucher-card-bikinilista")).toContainText(
      "100 Gutscheine · Gesamtwert 13.500 €",
    );
    await expect(page.getByTestId("voucher-card-amazon")).toContainText(
      "100 Gutscheine · Gesamtwert 7.500 €",
    );
    for (const value of ["500 €", "150 €", "50 €"]) {
      await expect(page.getByTestId("voucher-card-bikinilista")).toContainText(value);
    }
    for (const value of ["250 €", "100 €", "20 €"]) {
      await expect(page.getByTestId("voucher-card-amazon")).toContainText(value);
    }
    await expect(
      page.getByRole("heading", { name: "300 Gutscheine. Drei Marken. Viele Wünsche." }),
    ).toBeVisible();

    // Teilen-URL sichtbar und exakt (keine UTM-Parameter der Kampagne)
    await expect(page.getByTestId("share-url").first()).toHaveText(CANONICAL);

    // Händlerlinks (Amazon primär) und Buchdaten aus der Konfiguration
    await expect(page.getByRole("link", { name: /Bei Amazon vorbestellen/ })).toHaveAttribute(
      "href",
      "https://link.amazon/B0eyhvaQw",
    );
    await expect(page.getByRole("link", { name: /^Thalia/ })).toHaveAttribute(
      "href",
      /thalia\.de/,
    );
    await expect(page.getByText("9783690662505")).toBeVisible();

    // Consent-Banner vor Entscheidung sichtbar, Formular trotzdem bedienbar
    await expect(page.getByTestId("consent-banner")).toBeVisible();
    await expect(page.getByRole("button", { name: "Teilnahme absenden" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Buch bestellt? Jetzt bist du dran." })).toBeVisible();
  });

  test("Consent: kein Beacon vor der Entscheidung, genau ein PageView nach Zustimmung, keiner nach Ablehnung", async ({
    page,
    context,
  }) => {
    await blockExternal(page);
    const beacons: Array<{ type: string; status: number }> = [];
    page.on("response", async (response) => {
      if (!response.url().endsWith("/api/book/events")) return;
      const body = JSON.parse(response.request().postData() ?? "{}") as { type: string };
      beacons.push({ type: body.type, status: response.status() });
    });

    await page.goto("/verlosung");
    await page.waitForTimeout(1500);
    expect(beacons).toHaveLength(0);
    expect(await fbqCalls(page)).toHaveLength(0);

    await acceptConsent(page);
    await expect.poll(() => beacons.length).toBe(1);
    expect(beacons[0]).toMatchObject({ type: "PageView", status: 204 });
    const consentCookie = (await context.cookies()).find((c) => c.name === "marketing_consent");
    expect(consentCookie?.value).toBe("accepted");

    // Widerruf über den Footer-Link → Cookie "denied", danach keine weiteren Events
    await page.getByRole("button", { name: "Cookie-Einstellungen" }).click();
    await expect(page.getByTestId("consent-banner")).toBeVisible();
    await page.getByRole("button", { name: "Nur notwendige" }).click();
    const revoked = (await context.cookies()).find((c) => c.name === "marketing_consent");
    expect(revoked?.value).toBe("denied");

    // Neuer Aufruf mit Ablehnung: kein Beacon
    await page.goto("/verlosung");
    await page.waitForTimeout(1500);
    expect(beacons).toHaveLength(1);
    await expect(page.getByTestId("consent-banner")).toHaveCount(0);
  });

  test("Teilnahme direkt auf /verlosung: Erfolg, dedupliziertes Registrierungsevent, weitere Bestellnummer, Duplikat", async ({
    page,
  }) => {
    await blockExternal(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/verlosung${CAMPAIGN_QUERY}`);
    await acceptConsent(page);

    await fillEntry(page, ORDER_A, "erika.verlosung@test.local");
    // Mindestalter des Formular-Tokens (Bot-Schutz)
    await page.waitForTimeout(3200);
    await page.getByRole("button", { name: "Teilnahme absenden" }).click();

    await expect(page.getByText("Danke! Deine Anmeldung ist eingegangen.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText(
        "Wir berücksichtigen deine Teilnahme gemäß den Teilnahmebedingungen. Bewahre deine Bestellbestätigung auf.",
      ),
    ).toBeVisible();
    await expect(page.getByTestId("teilnahme-referenz")).toHaveText(/^[2-9A-HJKMNP-Z]{8}$/);
    // Keine Behauptung eines E-Mail-Versands (Mailer ist ein Stub)
    await expect(page.getByText(/Bestätigung wurde versendet/)).toHaveCount(0);

    // Browser-Event: CompleteRegistration mit Server-Ereignis-ID (UUID)
    const registration = (await fbqCalls(page)).filter(
      (call) => call[0] === "track" && call[1] === "CompleteRegistration",
    );
    expect(registration).toHaveLength(1);
    const eventId = (registration[0]![3] as { eventID?: string }).eventID;
    expect(eventId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    // Keine Formulardaten im Pixel-Payload
    expect(JSON.stringify(registration)).not.toContain(ORDER_A);
    expect(JSON.stringify(registration)).not.toContain("erika.verlosung");

    // Reduced Motion: Konfetti ohne Animation
    const animation = await page.evaluate(
      () => getComputedStyle(document.querySelector(".vl-confetti.burst i")!).animationName,
    );
    expect(animation).toBe("none");

    // Weitere Bestellnummer: neuer Vorgang mit leerem Formular
    await page.getByRole("button", { name: "Weitere Bestellnummer registrieren" }).click();
    await expect(page.getByLabel("Bestell- / Auftragsnummer")).toHaveValue("");
    await fillEntry(page, ORDER_B, "erika.verlosung@test.local", "thalia");
    await page.waitForTimeout(3200);
    await page.getByRole("button", { name: "Teilnahme absenden" }).click();
    await expect(page.getByText("Danke! Deine Anmeldung ist eingegangen.")).toBeVisible({
      timeout: 15_000,
    });
    const registrations = (await fbqCalls(page)).filter(
      (call) => call[0] === "track" && call[1] === "CompleteRegistration",
    );
    expect(registrations).toHaveLength(2);
    expect((registrations[1]![3] as { eventID?: string }).eventID).not.toBe(eventId);

    // Duplikat derselben Bestellnummer bleibt geschützt
    await page.getByRole("button", { name: "Weitere Bestellnummer registrieren" }).click();
    await fillEntry(page, ORDER_A, "max@test.local");
    await page.waitForTimeout(3200);
    await page.getByRole("button", { name: "Teilnahme absenden" }).click();
    await expect(
      page.getByText("Diese Bestellnummer wurde bereits für das Gewinnspiel registriert.").first(),
    ).toBeVisible({ timeout: 15_000 });
    // Eingaben bleiben nach dem Fehler erhalten
    await expect(page.getByLabel("Bestell- / Auftragsnummer")).toHaveValue(ORDER_A);
    expect(
      (await fbqCalls(page)).filter((call) => call[0] === "track" && call[1] === "CompleteRegistration"),
    ).toHaveLength(2);
  });

  test("Honeypot-Scheinerfolg löst kein Registrierungsevent aus", async ({ page }) => {
    await blockExternal(page);
    await page.goto("/verlosung");
    await acceptConsent(page);
    await fillEntry(page, ORDER_HONEYPOT, "bot@test.local");
    await page.evaluate(() => {
      (document.getElementById("website") as HTMLInputElement).value = "http://spam.example";
    });
    await page.waitForTimeout(3200);
    await page.getByRole("button", { name: "Teilnahme absenden" }).click();
    await expect(page.getByText("Danke! Deine Anmeldung ist eingegangen.")).toBeVisible({
      timeout: 15_000,
    });
    expect(
      (await fbqCalls(page)).filter((call) => call[0] === "track" && call[1] === "CompleteRegistration"),
    ).toHaveLength(0);
  });

  test("Admin: Teilnahmeweg /verlosung sichtbar und filterbar, Honeypot-Bestellung nicht gespeichert", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`/admin/gewinnspiel?path=${encodeURIComponent("/verlosung")}&order=${ORDER_A}`);
    const row = page.locator("tbody tr").first();
    await expect(row).toContainText("/verlosung");
    await expect(row.getByText(/^[2-9A-HJKMNP-Z]{8}$/)).toBeVisible();
    const detailsHref = await row.getByRole("link", { name: "Details" }).getAttribute("href");
    await page.goto(detailsHref!);
    await expect(page.getByText("Teilnahmeweg")).toBeVisible();
    await expect(page.getByText("/verlosung", { exact: true })).toBeVisible();
    await expect(page.getByText(/Bedingungen 1\.3/)).toBeVisible();
    await expect(page.getByText("Österreich")).toHaveCount(0);

    await page.goto(`/admin/gewinnspiel?order=${ORDER_HONEYPOT}`);
    await expect(page.getByText("Keine Teilnahmen für die aktuelle Filterung.").first()).toBeVisible();
  });

  test("Link kopieren: kanonische URL ohne Kampagnenparameter, ehrliche Bestätigung", async ({
    page,
  }) => {
    await page.goto(`/verlosung${CAMPAIGN_QUERY}`);
    await page.getByTestId("share-copy").first().click();
    await expect(page.getByText("Link kopiert – jetzt mit Freunden teilen!").first()).toBeVisible();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe(CANONICAL);
  });

  test("Bestand: /gewinn und Teilnahmebedingungen 1.3 mit allen drei Marken", async ({ page }) => {
    await page.goto("/gewinn");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Deine Buchbestellung könnte dich",
    );
    await page.goto("/gewinn/teilnahmebedingungen");
    await expect(page.getByText(/Version 1\.3/).first()).toBeVisible();
    for (const brand of ["Wiresoft", "Bikinilista", "Amazon"]) {
      await expect(page.getByText(brand, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText("lizenzzumerfolg.com/verlosung").first()).toBeVisible();
    await expect(page.getByText(/300 Wertgutscheine/)).toBeVisible();
  });

  test("Darstellung: kein horizontaler Overflow bei 320 px, Sticky-CTA mobil, Tastatur-Skip-Link, Screenshots", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/verlosung");
    const overflow = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const offenders = Array.from(document.querySelectorAll("body *"))
        .filter((el) => el.getBoundingClientRect().right > width + 1)
        .slice(0, 12)
        .map(
          (el) =>
            `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} → ${Math.round(el.getBoundingClientRect().right)}`,
        );
      return { px: document.documentElement.scrollWidth - width, offenders };
    });
    expect(overflow, JSON.stringify(overflow.offenders)).toMatchObject({ px: 0 });

    // Tastatur: erster Tab erreicht den Skip-Link
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Zum Teilnahmeformular springen" })).toBeFocused();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "test-results/verlosung-390-hero.png", fullPage: false });
    await acceptConsent(page);

    // Sticky-CTA erst nach dem Hero, nicht bei fokussiertem Formular
    // (vor dem Ganzseiten-Screenshot geprüft – dieser verändert kurz den Viewport)
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByTestId("sticky-cta")).toHaveCount(0);
    await page.getByRole("heading", { name: "Häufige Fragen" }).scrollIntoViewIfNeeded();
    await expect(page.getByTestId("sticky-cta")).toBeVisible();
    await page.getByLabel("Vorname").focus();
    await expect(page.getByTestId("sticky-cta")).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: "test-results/verlosung-390-full.png", fullPage: true });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/verlosung");
    await page.screenshot({ path: "test-results/verlosung-1440-hero.png", fullPage: false });
    await page.screenshot({ path: "test-results/verlosung-1440-full.png", fullPage: true });
  });
});
