/**
 * Visuelle Abnahme des TRACK.SITE-Redesigns: Screenshots der Kernseiten
 * bei 390 px (mobil) und 1280 px (Desktop), hell und dunkel, plus
 * Overflow-Check (scrollWidth <= innerWidth) auf Mobil.
 * Server: npm run start -- -p 3100 mit .env.test (Login siehe unten).
 */
import { mkdirSync } from "node:fs";
import { chromium, type BrowserContext } from "@playwright/test";

const BASE = "http://127.0.0.1:3100";
const OUT = process.env.SHOT_DIR ?? "visual-shots";
const PAGES = [
  ["uebersicht", "/admin"],
  ["analytics", "/admin/analytics"],
  ["kurzlinks", "/admin/links"],
  ["klicks", "/admin/clicks"],
  ["ziele", "/admin/destinations"],
  ["websites", "/admin/websites"],
  ["gewinnspiel", "/admin/gewinnspiel"],
  ["amazon", "/admin/amazon"],
  ["amazon-buch", "/admin/amazon/buch"],
  ["settings", "/admin/settings"],
] as const;

async function login(context: BrowserContext) {
  const page = await context.newPage();
  await page.goto(`${BASE}/admin/login`);
  await page.getByLabel("E-Mail-Adresse").fill("admin@test.local");
  await page.getByLabel("Passwort").fill("E2E-Testpasswort-123!");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL(/\/admin(?:$|\?)/, { timeout: 20_000 });
  await page.close();
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const issues: string[] = [];

  for (const theme of ["light", "dark"] as const) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    });
    await context.addCookies([
      { name: "theme", value: theme, url: BASE },
    ]);
    await login(context);
    const page = await context.newPage();

    for (const [name, path] of PAGES) {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(350);
      await page.screenshot({ path: `${OUT}/${name}-desktop-${theme}.png` });

      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(350);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      if (overflow > 1) issues.push(`${name} (${theme}): mobiler Overflow ${overflow}px`);
      await page.screenshot({ path: `${OUT}/${name}-mobil-${theme}.png`, fullPage: false });
    }
    await page.close();
    await context.close();
  }

  await browser.close();
  if (issues.length) {
    console.log("PROBLEME:");
    for (const issue of issues) console.log(" - " + issue);
  } else {
    console.log("OK: kein mobiler Overflow auf allen Seiten (hell + dunkel).");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
