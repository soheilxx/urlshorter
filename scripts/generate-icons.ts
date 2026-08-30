/**
 * Generiert die PWA-Icons (public/icon-192.png, public/icon-512.png) im
 * TRACK.SITE-Design: Königsblau-Verlauf + weiße Activity-Linie.
 * Ausführen: npx tsx scripts/generate-icons.ts (nutzt Playwright-Chromium).
 */
import { chromium } from "@playwright/test";

const svg = (size: number) => `<!doctype html><html><body style="margin:0">
<div id="icon" style="width:${size}px;height:${size}px;background:linear-gradient(135deg,#2f74ff 0%,#1f62ff 45%,#1550e6 100%);display:flex;align-items:center;justify-content:center;border-radius:0">
  <svg width="${size * 0.56}" height="${size * 0.56}" viewBox="0 0 24 24" fill="none"
       stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>
  </svg>
</div></body></html>`;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const size of [192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(svg(size));
    await page
      .locator("#icon")
      .screenshot({ path: `public/icon-${size}.png`, type: "png" });
    console.log(`public/icon-${size}.png geschrieben`);
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
