/**
 * Visuelle Abnahme der Gutscheinaktion gegen den lokalen Server (Port 3100):
 * 1) echte CSV über das Dashboard importieren (prüft den Parser mit der Datei)
 * 2) Dashboard-Screenshots (Desktop + Mobil)
 * 3) /gutschein bei 360/390/1280 px + Formular ausfüllen → Bestätigungsfenster
 * Aufruf: CSV_PATH=<pfad> SHOT_DIR=<dir> npx tsx scripts/check-gutschein.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:3100";
const OUT = process.env.SHOT_DIR ?? "gutschein-shots";
const CSV = process.env.CSV_PATH ?? "";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  // --- Admin: Import + Dashboard ---------------------------------------
  const admin = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const a = await admin.newPage();
  await a.goto(`${BASE}/admin/login`);
  await a.getByLabel("E-Mail-Adresse").fill("admin@test.local");
  await a.getByLabel("Passwort").fill("E2E-Testpasswort-123!");
  await a.getByRole("button", { name: "Anmelden" }).click();
  await a.waitForURL(/\/admin(?:$|\?)/);
  await a.goto(`${BASE}/admin/gutscheine`);
  if (CSV) {
    await a.getByLabel("CSV- oder TXT-Datei").setInputFiles(CSV);
    await a.getByLabel("Bezeichnung der Charge (optional)").fill("voucherCodes.csv");
    await a.getByRole("button", { name: "Codes importieren" }).click();
    const msg = a.locator('[role="status"], [role="alert"]').first();
    await msg.waitFor({ timeout: 30_000 });
    console.log("Import: " + (await msg.textContent())?.trim());
    await a.waitForTimeout(800);
  }
  await a.screenshot({ path: join(OUT, "dashboard-1280.png"), fullPage: true });
  await a.setViewportSize({ width: 390, height: 800 });
  await a.goto(`${BASE}/admin/gutscheine`, { waitUntil: "networkidle" });
  await a.screenshot({ path: join(OUT, "dashboard-390.png"), fullPage: true });
  await admin.close();

  // --- Öffentlich: Landingpage + Formular -------------------------------
  for (const width of [360, 390, 1280]) {
    const ctx = await browser.newContext({
      viewport: { width, height: width < 800 ? 800 : 900 },
      isMobile: width < 800,
      hasTouch: width < 800,
      deviceScaleFactor: 2,
    });
    const p = await ctx.newPage();
    await p.route("**/*youtube-nocookie.com/**", (r) => r.fulfill({ status: 200, body: "" }));
    await p.route("**/*open.spotify.com/**", (r) => r.fulfill({ status: 200, body: "" }));
    await p.goto(`${BASE}/gutschein?utm_source=newsletter`, { waitUntil: "networkidle" });
    const overflow = await p.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    console.log(`${width}px: Overflow ${overflow}px`);
    await p.screenshot({ path: join(OUT, `gutschein-${width}.png`), fullPage: true });

    if (width === 390 || width === 1280) {
      await p.getByLabel("Händler").selectOption("thalia");
      await p.getByLabel("Bestell- / Auftragsnummer").fill(`TH-${width}-${Date.now()}`);
      await p.getByLabel("Vorname").fill("Erika");
      await p.getByLabel("Nachname").fill("Musterfrau");
      await p.getByLabel("E-Mail-Adresse").fill(`erika-${width}@test.local`);
      await p.getByLabel(/Angaben korrekt sind/).check();
      await p.waitForTimeout(3200);
      await p.getByRole("button", { name: "Gutscheincode jetzt anzeigen" }).click();
      const dialog = p.getByRole("dialog", { name: /Gutschein/ });
      await dialog.waitFor({ timeout: 15_000 });
      const code = await dialog.getByTestId("gutschein-code").textContent();
      console.log(`${width}px: Code im Dialog = ${code}`);
      await p.screenshot({ path: join(OUT, `gutschein-dialog-${width}.png`) });
      await dialog.getByRole("button", { name: "Ich habe den Code gespeichert" }).click();
      await p.waitForTimeout(300);
      await p.screenshot({ path: join(OUT, `gutschein-karte-${width}.png`) });
    }
    await ctx.close();
  }
  await browser.close();
  console.log("Screenshots → " + OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
