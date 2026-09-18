import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

/**
 * E2E: TCG-Gewinnspiel /cards (eigenständige Kampagne cards_2026).
 * Läuft gegen den Produktions-Build mit .env.test (Test-Pixel-IDs, echte
 * Test-Datenbank). Tracking auf /cards läuft ohne Consent-Gate
 * (Betreiber-Entscheidung 18.09.2026, siehe docs/cards-kampagne.md).
 */

const STAMP = Date.now().toString().slice(-7);
const ORDER_A = `306-${STAMP}-2000001`;
const ORDER_B = `TH-${STAMP}-C2`;
const ORDER_SHARED = `306-${STAMP}-3000003`;
const ORDER_HONEYPOT = `306-${STAMP}-9000009`;
const CANONICAL = "https://lizenzzumerfolg.com/cards";
const AMAZON = "https://link.amazon/B0eyhvaQw";
const CAMPAIGN_QUERY = "?utm_source=reddit&utm_medium=social&utm_campaign=cards_launch_2026";
const REFERENCE = /^[2-9A-HJKMNP-Z]{8}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Das Rate Limit (5 Registrierungen je Client-Kennung = IP + User-Agent pro
 * Stunde) gilt kampagnenübergreifend. Damit die Registrierungsflüsse dieser
 * Datei nicht das Kontingent der anderen Specs (gewinn, verlosung) verbrauchen,
 * laufen sie mit eigenen, normalen Browser-User-Agents.
 */
const UA = (chrome: string) =>
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chrome} Safari/537.36`;

/** Externe Pixel-Skripte blockieren – geprüft wird nur die First-Party-Kette. */
async function blockExternal(page: Page) {
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort(),
  );
}

async function fillEntry(page: Page, orderNumber: string, email: string, retailer = "amazon") {
  await page.getByLabel("Händler", { exact: true }).selectOption(retailer);
  await page.getByLabel("Bestell- / Auftragsnummer").fill(orderNumber);
  await page.getByLabel("Vorname").fill("Kenji");
  await page.getByLabel("Nachname").fill("Sammler");
  await page.getByLabel("Straße").fill("Kartenweg");
  await page.getByLabel("Hausnummer").fill("17");
  await page.getByLabel("Postleitzahl").fill("20095");
  await page.getByLabel("Ort").fill("Hamburg");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Telefonnummer (mit Ländervorwahl)").fill("+49 170 1234567");
  await page.getByLabel(/Angaben vollständig und korrekt/).check();
}

async function fbqCalls(page: Page) {
  return page.evaluate(() => {
    const queue = (window as Window & { fbq?: { queue?: unknown[][] } }).fbq?.queue ?? [];
    return queue.map((entry) => Array.from(entry as unknown[]));
  });
}

async function dataLayer(page: Page) {
  return page.evaluate(() =>
    ((window as Window & { dataLayer?: unknown[] }).dataLayer ?? []).map((entry) =>
      entry && typeof (entry as { length?: unknown }).length === "number"
        ? JSON.stringify(Array.from(entry as ArrayLike<unknown>))
        : JSON.stringify(entry),
    ),
  );
}

async function openDialog(page: Page) {
  await page.getByRole("link", { name: "Buch schon gekauft? Jetzt eintragen" }).first().click();
  await expect
    .poll(() => page.evaluate(() => document.querySelector("dialog")?.matches(":modal") ?? false))
    .toBe(true);
}

const SUBMIT = "Bestellnummer für das Cards-Gewinnspiel registrieren";

test.describe("TCG-Gewinnspiel /cards", () => {
  test("rendert Hero, Hauptgewinn, alle vier Gewinnkategorien mit exakten Mengen, Termine und Share-URL", async ({
    page,
  }) => {
    await page.goto(`/cards${CAMPAIGN_QUERY}`);

    await expect(page).toHaveTitle(
      "One Piece OP-17 Case gewinnen – TCG-Gewinnspiel | Die Lizenz zum Erfolg",
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", CANONICAL);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      `${CANONICAL}/og.jpg`,
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /OP-17 Case zu gewinnen/,
    );
    const ogDescription = await page
      .locator('meta[property="og:description"]')
      .getAttribute("content");
    expect(ogDescription).toContain("12 Boxes");
    expect(ogDescription).not.toMatch(/Bestellnummer|registrier/i);
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toContainText("Ein ganzes OP-17 Case.");
    await expect(h1).toContainText("Vielleicht bald deins.");
    await expect(page.getByTestId("hero-badge")).toHaveText(
      /Hauptgewinn · 1 × One Piece OP-17 Case/i,
    );
    await expect(page.getByTestId("hero-dates")).toHaveText(
      "Teilnahmeschluss: 05.10.2026, 23:59 Uhr (MESZ) · Gewinnerbekanntgabe: 21.10.2026, 12 Uhr",
    );
    await expect(
      page.getByText(
        "Buchkauf + Registrierung der Bestellnummer erforderlich. Die Teilnahme erfolgt nicht automatisch.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("100 % der Autoreneinnahmen gehen an den Kinderschutzbund."),
    ).toBeVisible();

    // Kompakte Gewinnübersicht: exakte Mengen und Einheiten
    const chips = page.getByTestId(/^prize-chip-/);
    await expect(chips).toHaveCount(4);
    await expect(page.getByTestId("prize-chip-op17_case")).toHaveText("1 × OP-17 Case (12 Boxes)");
    await expect(page.getByTestId("prize-chip-fusion_world_st01_display")).toHaveText(
      "3 × ST01 Display",
    );
    await expect(page.getByTestId("prize-chip-magnificent_monsters_eu_case")).toHaveText(
      "3 × Magnificent Monsters Case (EU)",
    );
    await expect(page.getByTestId("prize-chip-cardmarket_100")).toHaveText("10 × 100 € Cardmarket");

    // Hauptgewinn-Sektion und Nebenbühnen
    await expect(
      page.getByRole("heading", { name: "Ein ganzes Case. Ein großer Moment für deine Sammlung." }),
    ).toBeVisible();
    await expect(page.getByTestId("main-prize-name")).toHaveText("1 × One Piece OP-17 Case");
    const db = page.getByTestId("prize-panel-fusion_world_st01_display");
    await expect(db).toContainText("3 × Story Booster 01 Display");
    await expect(db).toContainText("1 Display = 20 Packs");
    await expect(db.getByRole("img", { name: /Story Booster 01/ })).toBeVisible();
    await expect(db).toContainText("Dragon Ball Super Card Game Fusion World");
    await expect(db).toContainText("ST01");
    const ygo = page.getByTestId("prize-panel-magnificent_monsters_eu_case");
    await expect(ygo).toContainText("3 × Magnificent Monsters Case");
    await expect(ygo).toContainText("1 Case = 12 Boxen");
    await expect(ygo.getByRole("img", { name: /Magnificent Monsters/ })).toBeVisible();
    // Hauptgewinn: echtes Produktbild + Case-Badge + Teilen-Button im Hero
    await expect(page.getByTestId("hero-stage").getByRole("img", { name: /OP-17/ })).toBeVisible();
    await expect(page.getByTestId("hero-stage")).toContainText("1 Case = 12 Boxes");
    await expect(page.getByTestId("voucher-card").first()).toContainText("10 × 100 €");
    await expect(page.getByTestId("hero-share")).toBeVisible();
    expect(await page.locator("body").innerText()).not.toMatch(/vorbestellen/i);
    await expect(page.getByTestId("yugioh-variant")).toHaveText("EU Version");
    const cm = page.getByTestId("prize-panel-cardmarket_100");
    await expect(cm).toContainText("10 × 100 € Cardmarket-Wertgutschein");
    await expect(cm).toContainText("1.000 €");
    await expect(page.getByTestId("donation-promise")).toHaveText(
      "Soheil Hosseini spendet 100 % seiner Einnahmen aus diesem Buch an den Kinderschutzbund.",
    );

    // Jeder Bestell-CTA führt direkt zu Amazon (neuer Tab)
    const heroAmazon = page.getByRole("link", { name: /Buch bei Amazon bestellen/ }).first();
    await expect(heroAmazon).toHaveAttribute("href", AMAZON);
    await expect(heroAmazon).toHaveAttribute("target", "_blank");
    const amazonLinks = page.locator(`a[href="${AMAZON}"]`);
    expect(await amazonLinks.count()).toBeGreaterThanOrEqual(6);
    for (const link of await amazonLinks.all()) {
      await expect(link).toHaveAttribute("target", "_blank");
    }

    // Share-URL sichtbar und exakt; Formular sofort bedienbar; eigene Bedingungen
    await expect(page.getByTestId("share-url").first()).toHaveText(CANONICAL);
    await expect(page.getByTestId("consent-banner")).toHaveCount(0);
    await expect(page.getByRole("button", { name: SUBMIT })).toBeVisible();
    await expect(page.getByTestId("campaign-note")).toHaveText(
      "Diese Anmeldung gilt ausschließlich für das Cards-Gewinnspiel.",
    );
    // Vorgaben des Auftraggebers: keine Dubai-Nennung in den FAQ, keine Werbung für andere Händler
    expect(await page.locator("#faq").innerText()).not.toMatch(/Dubai/);
    expect(await page.locator("main").innerText()).not.toMatch(/Weitere Händler/);
    await expect(
      page.locator('a[href*="thalia"], a[href*="hugendubel"], a[href*="buecher.de"]'),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Teilnahmebedingungen", exact: true }),
    ).toHaveAttribute("href", "/cards/teilnahmebedingungen");
    await expect(
      page.getByRole("heading", { name: "Jede gültige Bestellnummer zählt als ein Los." }),
    ).toBeVisible();
  });

  test("Tracking ohne Consent-Gate: PageView-Beacons für /cards, GA4, Amazon-Klick als AddToCart-Proxy mit Kampagnensemantik", async ({
    page,
  }) => {
    await blockExternal(page);
    const beacons: Array<{
      endpoint: string;
      type: string;
      status: number;
      ctaId?: string;
      path?: string;
    }> = [];
    page.on("response", async (response) => {
      const url = response.url();
      if (!url.endsWith("/api/book/events") && !url.endsWith("/api/reddit/events")) return;
      const body = JSON.parse(response.request().postData() ?? "{}") as {
        type?: string;
        ctaId?: string;
        path?: string;
      };
      beacons.push({
        endpoint: url.endsWith("/api/book/events") ? "book" : "reddit",
        type: body.type ?? "?",
        status: response.status(),
        ctaId: body.ctaId,
        path: body.path,
      });
    });

    await page.goto(`/cards${CAMPAIGN_QUERY}`);
    await expect.poll(() => beacons.filter((b) => b.endpoint === "book").length).toBe(1);
    expect(beacons.find((b) => b.endpoint === "book")).toMatchObject({
      type: "PageView",
      status: 204,
      path: "/cards",
    });
    await expect.poll(() => beacons.filter((b) => b.endpoint === "reddit").length).toBe(1);
    expect(beacons.find((b) => b.endpoint === "reddit")).toMatchObject({
      type: "PageVisit",
      status: 204,
      path: "/cards",
    });

    await expect(page.locator('script[src*="googletagmanager.com/gtag/js?id=G-"]')).toHaveCount(1);
    const before = await dataLayer(page);
    expect(before.some((e) => e.includes('"config"') && e.includes('"G-'))).toBe(true);
    expect(before.some((e) => e.includes("cards_seite"))).toBe(true);

    // Amazon-Button im Hero: AddToCart bei Buch- UND Reddit-Collector, GA4 add_to_cart mit Semantik, kein Purchase
    const popupPromise = page.waitForEvent("popup");
    await page
      .getByRole("link", { name: /Buch bei Amazon bestellen/ })
      .first()
      .click();
    const popup = await popupPromise;
    await popup.close();
    await expect.poll(() => beacons.filter((b) => b.type === "AddToCart").length).toBe(2);
    expect(
      beacons
        .filter((b) => b.type === "AddToCart")
        .map((b) => `${b.endpoint}:${b.status}`)
        .sort(),
    ).toEqual(["book:204", "reddit:204"]);
    expect(beacons.find((b) => b.endpoint === "book" && b.type === "AddToCart")?.ctaId).toBe(
      "hero_amazon",
    );
    const calls = await fbqCalls(page);
    const addToCart = calls.filter((c) => c.includes("AddToCart"));
    expect(addToCart).toHaveLength(1);
    const metaData = JSON.stringify(addToCart[0]![3]);
    expect(metaData).toContain('"giveaway_campaign":"cards_2026"');
    expect(metaData).toContain('"conversion_semantics":"amazon_outbound_proxy"');
    expect(metaData).toContain('"cta_position":"hero_amazon"');
    expect(metaData).toContain('"value":18');
    expect(calls.some((c) => c[0] === "trackCustom")).toBe(false);
    const afterAmazon = await dataLayer(page);
    const ga4AddToCart = afterAmazon.find((e) => e.startsWith('["event","add_to_cart"'));
    expect(ga4AddToCart).toBeTruthy();
    expect(ga4AddToCart).toContain('"giveaway_campaign":"cards_2026"');
    expect(ga4AddToCart).toContain('"landing_path":"/cards"');
    expect(ga4AddToCart).toContain('"quantity":1');
    expect(afterAmazon.join(" ").toLowerCase()).not.toContain("purchase");

    // Teilnahme-Button: Dialog öffnet sofort, GA4-Events mit Kampagnenparameter – kein Pixel-Aufruf
    await openDialog(page);
    await expect
      .poll(async () => {
        const entries = await dataLayer(page);
        return (
          entries.some(
            (e) => e.includes("cards_cta_teilnehmen_hero") && e.includes("cards_2026"),
          ) && entries.some((e) => e.includes("cards_formular_geoeffnet"))
        );
      })
      .toBe(true);
    expect(JSON.stringify(await fbqCalls(page))).not.toContain("cards_formular_geoeffnet");
    await page.keyboard.press("Escape");
  });

  test.describe("Registrierungsfluss", () => {
    test.use({ userAgent: UA("127.0.0.0") });

    test("Registrierung: Speicherung, /cards/danke mit einmaligem Konfetti und Registrierungsevent; Reload, Direktaufruf, weitere Nummer, Duplikat", async ({
      page,
      browser,
    }) => {
      await blockExternal(page);
      await page.goto(`/cards${CAMPAIGN_QUERY}`);
      await openDialog(page);
      await fillEntry(page, ORDER_A, "kenji.cards@test.local");
      await page.waitForTimeout(3200);
      await page.getByRole("button", { name: SUBMIT }).click();

      // Weiterleitung auf die Bestätigungsseite (kein ?success, keine Daten in der URL)
      await expect(page).toHaveURL(/\/cards\/danke$/, { timeout: 15_000 });
      await expect(
        page.getByRole("heading", { name: "Deine Anmeldung ist eingegangen!" }),
      ).toBeVisible();
      await expect(page.getByText("Registrierung eingegangen – Prüfung ausstehend")).toBeVisible();
      await expect(
        page.getByText("Die Gewinnerbekanntgabe findet am 21.10.2026 um 12 Uhr statt."),
      ).toBeVisible();
      await expect(page.getByTestId("teilnahme-referenz")).toHaveText(REFERENCE);
      await expect(page.getByText(/Bestätigung wurde versendet/)).toHaveCount(0);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      await expect(page.getByTestId("cards-erfolg")).toHaveAttribute("data-celebrated", "1");
      await expect(page.getByTestId("cards-confetti")).toBeVisible();
      await expect(page.getByTestId("cards-confetti")).toHaveCount(0, { timeout: 6_000 });

      // Receipt-Cookie: httpOnly, nur für /cards/danke
      const receipt = (await page.context().cookies()).find((c) => c.name === "lze_cards_receipt");
      expect(receipt).toMatchObject({ httpOnly: true, path: "/cards/danke" });
      expect(receipt?.value).not.toContain(ORDER_A);

      // Browser-Registrierungsevent genau einmal, mit Server-Ereignis-ID und Kampagne – ohne Formulardaten
      await expect
        .poll(
          async () =>
            (await fbqCalls(page)).filter(
              (c) => c[0] === "track" && c[1] === "CompleteRegistration",
            ).length,
        )
        .toBe(1);
      const registration = (await fbqCalls(page)).filter(
        (c) => c[0] === "track" && c[1] === "CompleteRegistration",
      );
      const eventId = (registration[0]![3] as { eventID?: string }).eventID;
      expect(eventId).toMatch(UUID);
      expect(JSON.stringify(registration)).toContain('"content_category":"cards_2026"');
      expect(JSON.stringify(registration)).not.toContain(ORDER_A);
      expect(JSON.stringify(registration)).not.toContain("kenji.cards");
      const layer = await dataLayer(page);
      expect(
        layer.some((e) => e.includes("gewinnspiel_teilnahme") && e.includes("cards_2026")),
      ).toBe(true);

      // Reload: Bestätigung bleibt (Receipt gültig), aber keine erneute Feier, kein erneutes Event
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Deine Anmeldung ist eingegangen!" }),
      ).toBeVisible();
      await expect(page.getByTestId("cards-erfolg")).toHaveAttribute("data-celebrated", "0");
      await expect(page.getByTestId("cards-confetti")).toHaveCount(0);
      await page.waitForTimeout(1500);
      expect((await fbqCalls(page)).filter((c) => c[1] === "CompleteRegistration")).toHaveLength(0);

      // Direktaufruf ohne Receipt (neuer Browserkontext): keine Bestätigung
      const fresh = await browser.newContext();
      const direct = await fresh.newPage();
      await direct.goto("/cards/danke");
      await expect(direct.getByTestId("cards-kein-vorgang")).toBeVisible();
      await expect(direct.getByText("Deine Anmeldung ist eingegangen!")).toHaveCount(0);
      await fresh.close();

      // Weitere Bestellnummer: neuer Vorgang (leeres Formular im Dialog), neue Feier – mit reduced motion statisch
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.getByRole("link", { name: "Weitere Bestellnummer eintragen" }).click();
      await expect(page).toHaveURL(/\/cards#teilnehmen$/);
      await expect
        .poll(() =>
          page.evaluate(() => document.querySelector("dialog")?.matches(":modal") ?? false),
        )
        .toBe(true);
      await expect(page.getByLabel("Bestell- / Auftragsnummer")).toHaveValue("");
      await fillEntry(page, ORDER_B, "kenji.cards@test.local", "thalia");
      await page.waitForTimeout(3200);
      await page.getByRole("button", { name: SUBMIT }).click();
      await expect(page).toHaveURL(/\/cards\/danke$/, { timeout: 15_000 });
      await expect(page.getByTestId("cards-erfolg")).toHaveAttribute("data-celebrated", "1");
      await expect(page.getByTestId("cards-confetti")).toHaveCount(0);
      await expect
        .poll(
          async () =>
            (await fbqCalls(page)).filter(
              (c) => c[0] === "track" && c[1] === "CompleteRegistration",
            ).length,
        )
        .toBe(1);
      const second = (await fbqCalls(page)).filter((c) => c[1] === "CompleteRegistration");
      expect((second[0]![3] as { eventID?: string }).eventID).not.toBe(eventId);

      // Duplikat derselben Bestellnummer innerhalb von Cards: Fehler im Formular, keine Weiterleitung
      await page.goto("/cards#teilnehmen");
      await expect
        .poll(() =>
          page.evaluate(() => document.querySelector("dialog")?.matches(":modal") ?? false),
        )
        .toBe(true);
      await fillEntry(page, ORDER_A, "max@test.local");
      await page.waitForTimeout(3200);
      await page.getByRole("button", { name: SUBMIT }).click();
      await expect(
        page
          .getByText("Diese Bestellnummer wurde bereits für das Cards-Gewinnspiel registriert.")
          .first(),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page).toHaveURL(/\/cards(#teilnehmen)?$/);
      await expect(page.getByLabel("Bestell- / Auftragsnummer")).toHaveValue(ORDER_A);
    });
  });

  test("Honeypot-Scheinerfolg: neutrale Bestätigung ohne Feier und ohne Registrierungsevent", async ({
    page,
  }) => {
    await blockExternal(page);
    await page.goto("/cards");
    await fillEntry(page, ORDER_HONEYPOT, "bot@test.local");
    await page.evaluate(() => {
      (document.getElementById("website") as HTMLInputElement).value = "http://spam.example";
    });
    await page.waitForTimeout(3200);
    await page.getByRole("button", { name: SUBMIT }).click();
    await expect(page).toHaveURL(/\/cards\/danke$/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: "Deine Anmeldung ist eingegangen!" }),
    ).toBeVisible();
    await expect(page.getByTestId("cards-erfolg")).toHaveAttribute("data-celebrated", "0");
    await expect(page.getByTestId("cards-confetti")).toHaveCount(0);
    await page.waitForTimeout(1500);
    expect((await fbqCalls(page)).filter((c) => c[1] === "CompleteRegistration")).toHaveLength(0);
  });

  test.describe("Kampagnentrennung", () => {
    test.use({ userAgent: UA("126.0.0.0") });

    test("Kampagnentrennung: dieselbe Bestellnummer bei /verlosung UND /cards, Admin je Kampagne, Export nur mit Kampagne", async ({
      page,
    }) => {
      await blockExternal(page);
      // Dubai-Weg (/verlosung, Inline-Formular)
      await page.goto("/verlosung");
      await fillEntry(page, ORDER_SHARED, "shared@test.local");
      await page.waitForTimeout(3200);
      await page.getByRole("button", { name: "Teilnahme absenden" }).click();
      await expect(page.getByText("Danke! Deine Anmeldung ist eingegangen.")).toBeVisible({
        timeout: 15_000,
      });

      // Dieselbe Nummer bei Cards: eigener Eintrag im eigenen Lostopf
      await page.goto("/cards");
      await fillEntry(page, ORDER_SHARED, "shared@test.local");
      await page.waitForTimeout(3200);
      await page.getByRole("button", { name: SUBMIT }).click();
      await expect(page).toHaveURL(/\/cards\/danke$/, { timeout: 15_000 });

      await loginAsAdmin(page);
      await page.goto(`/admin/gewinnspiel?campaign=cards_2026&order=${ORDER_SHARED}`);
      let rows = page.locator("tbody tr");
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText("Cards");
      await expect(rows.first()).toContainText("/cards");
      await expect(page.getByTestId("campaign-counts")).toContainText("Cards");
      await expect(page.getByTestId("campaign-counts")).toContainText("Dubai");

      await page.goto(`/admin/gewinnspiel?campaign=dubai_2026&order=${ORDER_SHARED}`);
      rows = page.locator("tbody tr");
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText("Dubai");
      await expect(rows.first()).toContainText("/verlosung");

      await page.goto(`/admin/gewinnspiel?order=${ORDER_SHARED}`);
      await expect(page.locator("tbody tr")).toHaveCount(2);

      // Honeypot-Bestellung wurde nie gespeichert
      await page.goto(`/admin/gewinnspiel?order=${ORDER_HONEYPOT}`);
      await expect(
        page.getByText("Keine Teilnahmen für die aktuelle Filterung.").first(),
      ).toBeVisible();

      // Detailseite: Kampagne sichtbar, eigene Bedingungsversion
      await page.goto(`/admin/gewinnspiel?campaign=cards_2026&order=${ORDER_SHARED}`);
      const detailsHref = await page
        .locator("tbody tr")
        .first()
        .getByRole("link", { name: "Details" })
        .getAttribute("href");
      await page.goto(detailsHref!);
      await expect(page.getByText("Kampagne: Cards")).toBeVisible();
      // Bedingungsversion UND Gewinnumfang tragen die Cards-Kennung – nichts von Dubai
      await expect(page.getByText(/\(cards-1\.2 \(18\.09\.2026\)\)/)).toHaveCount(2);
      await expect(page.getByText(/dubai-reise/)).toHaveCount(0);

      // Export: nur mit Kampagne, Kennung in Datei und Dateiname
      const noCampaign = await page.request.get(`/api/export/sweepstakes?order=${ORDER_SHARED}`);
      expect(noCampaign.status()).toBe(400);
      const cardsExport = await page.request.get(
        `/api/export/sweepstakes?campaign=cards_2026&order=${ORDER_SHARED}`,
      );
      expect(cardsExport.status()).toBe(200);
      expect(cardsExport.headers()["content-disposition"]).toContain(
        "gewinnspiel-export-cards-cards_2026-",
      );
      const csv = await cardsExport.text();
      expect(csv).toContain("Kampagne;Referenz;Status;Gewinn;");
      expect(csv).toContain('"cards_2026"');
      expect(csv).not.toContain("dubai_2026");
      expect(csv.split("\r\n").filter((line) => line.includes('"cards_2026"'))).toHaveLength(1);
      const dubaiExport = await page.request.get(
        `/api/export/sweepstakes?campaign=dubai_2026&order=${ORDER_SHARED}`,
      );
      expect(dubaiExport.headers()["content-disposition"]).toContain(
        "gewinnspiel-export-dubai-dubai_2026-",
      );
      const dubaiCsv = await dubaiExport.text();
      expect(dubaiCsv).toContain('"dubai_2026"');
      expect(dubaiCsv).not.toContain("cards_2026");
    });
  });

  test("Teilnahmebedingungen Cards: Version, exakte Gewinne, Fristen, Cardmarket-Bedingungen, Dubai-Abgrenzung", async ({
    page,
  }) => {
    await page.goto("/cards/teilnahmebedingungen");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Teilnahmebedingungen Cards-Gewinnspiel",
    );
    await expect(page.getByText(/Version cards-1\.2 \(18\.09\.2026\)/)).toBeVisible();
    await expect(page.getByText("1 × One Piece OP-17 Case (OP-17)")).toBeVisible();
    await expect(page.getByText("3 × Story Booster 01 Display Fusion World (ST01)")).toBeVisible();
    await expect(page.getByText(/12 Booster Boxes à 24 Packs/)).toBeVisible();
    await expect(page.getByText("3 × Magnificent Monsters EU Version Case")).toBeVisible();
    await expect(page.getByText("10 × Cardmarket-Wertgutschein über 100 €")).toBeVisible();
    await expect(page.getByText(/05\.10\.2026, 23:59 Uhr \(MESZ\)/).first()).toBeVisible();
    await expect(
      page.getByText(/Gewinnerbekanntgabe erfolgt am 21\.10\.2026 um 12 Uhr/),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Cardmarket-Hilfe: Gutscheine" })).toHaveAttribute(
      "href",
      "https://help.cardmarket.com/de/cardmarket-coupons",
    );
    await expect(
      page.getByText(/kann für das Cards-Gewinnspiel einmal separat registriert werden/),
    ).toBeVisible();
    await expect(page.getByText(/Dubai-Reise/)).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("Darstellung: kein horizontaler Overflow bei 320 px, Sticky-Bar mobil, Screenshots 390/768/1440", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/cards");
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    // Sticky-Bar erscheint mobil, sobald der Hero aus dem Bild ist
    await page.evaluate(() => window.scrollTo(0, 2400));
    await expect(page.getByTestId("sticky-cta")).toBeVisible();
    await expect(
      page.getByTestId("sticky-cta").getByRole("link", { name: /Buch bestellen/ }),
    ).toHaveAttribute("href", AMAZON);
    await expect(
      page.getByTestId("sticky-cta").getByRole("link", { name: "Bestellnummer eintragen" }),
    ).toHaveAttribute("href", "#teilnehmen");

    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: width < 700 ? 844 : 900 });
      await page.goto("/cards");
      await page.waitForTimeout(900);
      const wide = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(wide, `Overflow bei ${width}px`).toBeLessThanOrEqual(0);
      await page.screenshot({
        path: `test-results/screenshots/cards-${width}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/cards/teilnahmebedingungen");
    await page.screenshot({
      path: "test-results/screenshots/cards-bedingungen-1440.png",
      fullPage: false,
    });
  });
});
