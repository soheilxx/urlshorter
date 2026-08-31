/**
 * Generiert das OpenGraph-Bild der Buch-Landingpage (public/das-buch/og.png,
 * 1200×630) im gewinn-theme-Look: warmes Schwarz, Gold-Akzente, Buchcover.
 * Ausführen: npx tsx scripts/generate-buch-og.ts (nutzt Playwright-Chromium).
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const cover =
  "data:image/jpeg;base64," + readFileSync("public/gewinn/buchcover.jpg").toString("base64");

const html = `<!doctype html><html><body style="margin:0">
<div id="og" style="width:1200px;height:630px;position:relative;overflow:hidden;
     background:#0d0b08;font-family:'Segoe UI',Arial,sans-serif;color:#f6f1e6;">
  <div style="position:absolute;inset:0;background:
       radial-gradient(60% 70% at 82% 30%, rgba(214,178,111,0.22) 0%, transparent 60%),
       radial-gradient(50% 60% at 8% 100%, rgba(214,178,111,0.10) 0%, transparent 60%);"></div>
  <div style="position:absolute;left:80px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;max-width:640px;">
    <div style="font-size:22px;letter-spacing:6px;text-transform:uppercase;color:#d6b26f;font-weight:600;">
      Neuerscheinung · 06.10.2026
    </div>
    <div style="margin-top:26px;font-size:76px;line-height:1.05;font-weight:700;letter-spacing:-1px;">
      Die Lizenz<br/>
      <span style="background:linear-gradient(105deg,#e8cd92 0%,#d6b26f 45%,#b78e4b 100%);
            -webkit-background-clip:text;background-clip:text;color:transparent;">zum Erfolg</span>
    </div>
    <div style="margin-top:26px;font-size:28px;line-height:1.35;color:#c9c0ac;max-width:560px;">
      Business ohne Plan, Ausreden oder Kompromisse
    </div>
    <div style="margin-top:20px;font-size:24px;color:#f6f1e6;">Das Buch von Soheil Hosseini</div>
    <div style="margin-top:14px;font-size:20px;color:#948a76;">Mit Song &amp; Musikvideo · Jetzt das Buch sichern</div>
  </div>
  <img src="${cover}" style="position:absolute;right:90px;top:75px;width:300px;height:480px;
       object-fit:cover;border-radius:6px 14px 14px 6px;transform:rotate(4deg);
       box-shadow:0 40px 80px -20px rgba(0,0,0,0.85), 0 0 0 1px rgba(214,178,111,0.25);"/>
</div></body></html>`;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.locator("#og").screenshot({ path: "public/das-buch/og.png", type: "png" });
  await browser.close();
  console.log("public/das-buch/og.png geschrieben (1200×630)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
