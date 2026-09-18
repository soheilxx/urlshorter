/**
 * Generiert das Vorschaubild des TCG-Gewinnspiels für Messenger/Social
 * (public/cards/og.jpg, 1200×630, JPEG < 300 KB für WhatsApp/Telegram):
 * echte Produktbilder (OP-17 Booster Box im Fokus, ST01 Display, Magnificent
 * Monsters Box), Goldlicht, klickstarke Headline – ohne Anleitungstext.
 * Ausführen: npx tsx scripts/generate-cards-og.ts (nutzt Playwright-Chromium).
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const asset = (file: string, mime: string) =>
  `data:${mime};base64,${readFileSync(`public/cards/${file}`).toString("base64")}`;

const op17 = asset("op17-booster-box.webp", "image/webp");
const st01 = asset("st01-display.webp", "image/webp");
const mamo = asset("magnificent-monsters-eu.png", "image/png");

const html = `<!doctype html><html><body style="margin:0">
<div id="og" style="width:1200px;height:630px;position:relative;overflow:hidden;background:#080c18;font-family:'Segoe UI',Arial,sans-serif;color:#f5f2e9;">
  <div style="position:absolute;inset:0;background:
       radial-gradient(46% 62% at 74% 50%, rgba(255,213,106,0.34) 0%, transparent 62%),
       radial-gradient(30% 40% at 96% 92%, rgba(168,139,255,0.22) 0%, transparent 60%),
       radial-gradient(30% 40% at 52% 96%, rgba(255,138,50,0.18) 0%, transparent 60%),
       radial-gradient(40% 50% at 4% 100%, rgba(81,217,237,0.14) 0%, transparent 60%),
       linear-gradient(180deg,#0a1020,#080c18);"></div>
  <div style="position:absolute;inset:0;background:repeating-linear-gradient(-28deg,transparent 0 22px,rgba(255,255,255,0.045) 22px 24px);-webkit-mask-image:linear-gradient(90deg,transparent 42%,#000 70%,transparent);"></div>
  <div style="position:absolute;right:0;top:0;bottom:0;width:120px;background-image:radial-gradient(rgba(183,194,216,0.22) 1px,transparent 1.4px);background-size:14px 14px;opacity:.5;"></div>

  <div style="position:absolute;left:64px;top:0;bottom:0;width:560px;display:flex;flex-direction:column;justify-content:center;">
    <div style="font-size:15px;letter-spacing:4px;text-transform:uppercase;color:#51d9ed;font-weight:700;white-space:nowrap;">TCG-Verlosung · One Piece · Dragon Ball · Yu-Gi-Oh!</div>
    <div style="margin-top:18px;font-size:70px;line-height:1.0;font-weight:800;letter-spacing:-1.8px;">Ein ganzes<br/>OP-17 Case.<br/><span style="background:linear-gradient(100deg,#ffe9a6,#ffd56a 40%,#f0b73a 65%,#ffe9a6);-webkit-background-clip:text;background-clip:text;color:transparent;">Vielleicht bald deins.</span></div>
    <div style="margin-top:22px;display:flex;gap:10px;flex-wrap:wrap;">
      <span style="border:1px solid rgba(255,213,106,0.8);background:rgba(255,213,106,0.12);color:#ffd56a;font-size:15px;font-weight:800;letter-spacing:1.5px;padding:8px 12px;border-radius:6px;">1 × OP-17 CASE · 12 BOXES</span>
      <span style="border:1px solid rgba(255,138,50,0.7);color:#ffb066;font-size:15px;font-weight:700;letter-spacing:1px;padding:8px 12px;border-radius:6px;">3 × ST01 DISPLAY</span>
      <span style="border:1px solid rgba(168,139,255,0.7);color:#c9b8ff;font-size:15px;font-weight:700;letter-spacing:1px;padding:8px 12px;border-radius:6px;">3 × MAGNIFICENT MONSTERS CASE (EU)</span>
      <span style="border:1px solid rgba(101,189,255,0.7);color:#9fd4ff;font-size:15px;font-weight:700;letter-spacing:1px;padding:8px 12px;border-radius:6px;">10 × 100 € CARDMARKET</span>
    </div>
    <div style="margin-top:26px;font-size:24px;line-height:1.3;color:#f5f2e9;font-weight:600;">17 Gewinne für deine Sammlung.</div>
    <div style="margin-top:10px;font-size:17px;color:#8a97b0;">lizenzzumerfolg.com/cards · Verlosung zur Buchaktion „Die Lizenz zum Erfolg“</div>
  </div>

  <!-- Produktszene rechts: OP-17 dominant, ST01 Display links unten, Magnificent Monsters rechts unten -->
  <div style="position:absolute;left:700px;top:50px;width:470px;height:470px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,213,106,0.42),rgba(255,213,106,0.14) 45%,transparent 72%);"></div>
  <div style="position:absolute;left:610px;top:330px;width:260px;height:230px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,138,50,0.36),transparent 72%);"></div>
  <img src="${st01}" style="position:absolute;left:640px;top:330px;width:230px;height:230px;object-fit:contain;transform:rotate(-5deg);filter:drop-shadow(0 26px 30px rgba(0,0,0,0.75));"/>
  <div style="position:absolute;left:960px;top:250px;width:230px;height:230px;border-radius:50%;background:radial-gradient(closest-side,rgba(168,139,255,0.42),transparent 72%);"></div>
  <img src="${mamo}" style="position:absolute;left:985px;top:262px;width:190px;height:220px;object-fit:contain;transform:rotate(6deg);filter:drop-shadow(0 26px 30px rgba(0,0,0,0.8)) brightness(1.08);"/>
  <img src="${op17}" style="position:absolute;left:735px;top:80px;width:400px;height:410px;object-fit:contain;filter:drop-shadow(0 40px 50px rgba(0,0,0,0.85));"/>
  <div style="position:absolute;left:760px;top:495px;width:350px;height:36px;background:radial-gradient(60% 100% at 50% 50%,rgba(0,0,0,0.7),transparent 70%);"></div>
  <div style="position:absolute;left:770px;top:526px;display:inline-flex;align-items:center;gap:8px;padding:8px 12px 8px 8px;border-radius:8px;background:linear-gradient(180deg,#ffe28f,#ffd56a 60%,#d9a93a);color:#17120a;font-size:15px;font-weight:800;letter-spacing:1px;box-shadow:0 10px 24px -8px rgba(0,0,0,0.8);"><span style="display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:26px;padding:0 6px;border-radius:5px;background:rgba(23,18,10,0.9);color:#ffd56a;font-weight:800;">×12</span>1 CASE = 12 BOXES</div>
</div></body></html>`;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.locator("#og").screenshot({ path: "public/cards/og.jpg", type: "jpeg", quality: 84 });
  await browser.close();
  console.log("public/cards/og.jpg geschrieben (1200×630)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
