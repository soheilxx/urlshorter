/** Visuelle Abnahme /das-buch: Fullpage-Screenshots 360/390/1280 + Facade-Klick. */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:3100";
const OUT = process.env.SHOT_DIR ?? "das-buch-shots";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const width of [360, 390, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: width < 800 ? 800 : 900 },
      isMobile: width < 800,
      hasTouch: width < 800,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto(`${BASE}/das-buch`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    console.log(`${width}px: Overflow ${overflow}px`);
    await page.screenshot({ path: join(OUT, `das-buch-${width}.png`), fullPage: true });
    if (width === 390) {
      await page.getByRole("button", { name: /Video abspielen/ }).click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: join(OUT, `das-buch-390-video.png`) });
    }
    await context.close();
  }
  await browser.close();
  console.log("Screenshots → " + OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
