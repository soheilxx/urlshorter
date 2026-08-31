/**
 * Mobile-Audit: lädt JEDE Admin-Seite frisch bei 360 px und 390 px,
 * macht Fullpage-Screenshots (hell; Übersicht/Amazon zusätzlich dunkel),
 * misst Overflow-Verursacher und hält Interaktionszustände fest
 * (Kurzlink-Karte im Bestätigungszustand, „Mehr“-Sheet offen).
 * Ergebnis: PNGs + audit.json im SHOT_DIR.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";

const BASE = "http://127.0.0.1:3100";
const OUT = process.env.SHOT_DIR ?? "mobile-audit";
const WIDTHS = [360, 390];

const PAGES: Array<[string, string]> = [
  ["uebersicht", "/admin"],
  ["analytics", "/admin/analytics"],
  ["kurzlinks", "/admin/links"],
  ["kurzlink-neu", "/admin/links/new"],
  ["kurzlink-bulk", "/admin/links/bulk"],
  ["klicks", "/admin/clicks"],
  ["ziele", "/admin/destinations"],
  ["websites", "/admin/websites"],
  ["website-neu", "/admin/websites/neu"],
  ["gewinnspiel", "/admin/gewinnspiel"],
  ["benutzer", "/admin/users"],
  ["settings", "/admin/settings"],
  ["account", "/admin/account"],
  ["amazon", "/admin/amazon"],
  ["amazon-buch", "/admin/amazon/buch"],
  ["amazon-top25", "/admin/amazon/top25"],
  ["amazon-kategorien", "/admin/amazon/kategorien"],
  ["amazon-provider", "/admin/amazon/provider"],
  ["amazon-einstellungen", "/admin/amazon/einstellungen"],
];

interface Offender {
  tag: string;
  cls: string;
  text: string;
  right: number;
  left: number;
  width: number;
}

async function collectOffenders(page: Page): Promise<Offender[]> {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const out: Array<{
      tag: string; cls: string; text: string; right: number; left: number; width: number;
    }> = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const r = el.getBoundingClientRect();
      if ((r.right > vw + 1 || r.left < -1) && r.width > 24) {
        out.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.getAttribute("class") ?? "").slice(0, 110),
          text: (el.textContent ?? "").trim().slice(0, 50),
          right: Math.round(r.right),
          left: Math.round(r.left),
          width: Math.round(r.width),
        });
      }
    }
    return out.slice(0, 25);
  });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const report: Record<string, unknown> = {};

  for (const width of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width, height: 800 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
    });
    const page = await context.newPage();
    await page.goto(`${BASE}/admin/login`);
    await page.getByLabel("E-Mail-Adresse").fill("admin@test.local");
    await page.getByLabel("Passwort").fill("E2E-Testpasswort-123!");
    await page.getByRole("button", { name: "Anmelden" }).click();
    await page.waitForURL(/\/admin(?:$|\?)/, { timeout: 20_000 });

    for (const [name, path] of PAGES) {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      const scrollOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      const offenders = await collectOffenders(page);
      report[`${name}@${width}`] = { scrollOverflow, offenders };
      await page.screenshot({ path: join(OUT, `${name}-${width}.png`), fullPage: true });
    }

    // Interaktionszustand 1: Kurzlink-Karte mit offener Lösch-Bestätigung
    await page.goto(`${BASE}/admin/links`, { waitUntil: "networkidle" });
    const deactivate = page.getByRole("button", { name: "Deaktivieren", exact: true }).first();
    if (await deactivate.isVisible().catch(() => false)) {
      await deactivate.click();
      await page.waitForTimeout(250);
      report[`kurzlinks-confirm@${width}`] = {
        scrollOverflow: await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        ),
        offenders: await collectOffenders(page),
      };
      await page.screenshot({ path: join(OUT, `kurzlinks-confirm-${width}.png`), fullPage: false });
    }

    // Interaktionszustand 2: „Mehr“-Sheet offen
    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Mehr" }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, `mehr-sheet-${width}.png`), fullPage: false });

    await page.close();
    await context.close();
  }

  // Dark-Mode-Stichprobe bei 390 px
  const darkContext = await browser.newContext({
    viewport: { width: 390, height: 800 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
  });
  await darkContext.addCookies([{ name: "theme", value: "dark", url: BASE }]);
  const darkPage = await darkContext.newPage();
  await darkPage.goto(`${BASE}/admin/login`);
  await darkPage.getByLabel("E-Mail-Adresse").fill("admin@test.local");
  await darkPage.getByLabel("Passwort").fill("E2E-Testpasswort-123!");
  await darkPage.getByRole("button", { name: "Anmelden" }).click();
  await darkPage.waitForURL(/\/admin(?:$|\?)/, { timeout: 20_000 });
  for (const [name, path] of [
    ["uebersicht", "/admin"],
    ["amazon", "/admin/amazon"],
    ["kurzlinks", "/admin/links"],
  ] as Array<[string, string]>) {
    await darkPage.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await darkPage.waitForTimeout(400);
    await darkPage.screenshot({ path: join(OUT, `${name}-390-dark.png`), fullPage: true });
  }
  await darkPage.close();
  await darkContext.close();

  await browser.close();
  writeFileSync(join(OUT, "audit.json"), JSON.stringify(report, null, 2));

  // Kompakte Konsole: nur Seiten mit Overflow
  for (const [key, value] of Object.entries(report)) {
    const v = value as { scrollOverflow: number; offenders: Offender[] };
    if (v.scrollOverflow > 1 || v.offenders.length > 0) {
      console.log(`${key}: scrollOverflow=${v.scrollOverflow}px, offenders=${v.offenders.length}`);
    }
  }
  console.log("Audit fertig → " + OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
