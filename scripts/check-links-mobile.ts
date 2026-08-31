/** Gezielte Prüfung: Kurzlinks-Karte bei 360 px, Normal- und Bestätigungszustand. */
import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:3100";
const OUT = process.env.SHOT_DIR ?? "mobile-audit";

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
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
  await page.waitForURL(/\/admin(?:$|\?)/);
  await page.goto(`${BASE}/admin/links`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/links-normal-360.png` });
  const deactivate = page.getByRole("button", { name: "Deaktivieren", exact: true }).first();
  await deactivate.click();
  await page.waitForTimeout(250);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  console.log("Overflow im Bestätigungszustand: " + overflow + "px");
  await page.screenshot({ path: `${OUT}/links-confirm-360.png` });
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
