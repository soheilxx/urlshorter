/**
 * Generiert das OpenGraph-Bild des TCG-Gewinnspiels (public/cards/og.png,
 * 1200×630): dunkles Tintenblau, goldener OP-17-Fokus (illustrativer
 * Produktkörper, kein Verpackungs-/Logo-Nachbau), Nebenkategorien lesbar,
 * echtes Buchcover, Kurzzeile „Buch kaufen · Bestellnummer eintragen“.
 * Ausführen: npx tsx scripts/generate-cards-og.ts (nutzt Playwright-Chromium).
 */
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const cover =
  "data:image/jpeg;base64," + readFileSync("public/gewinn/buchcover.jpg").toString("base64");

function box(
  world: "onepiece" | "dragonball" | "yugioh",
  label: string,
  sub: string,
  size: number,
  x: number,
  y: number,
  rot: number,
  code: string,
) {
  const palette = {
    onepiece: ["#123a5c", "#071a2e", "#2a6a8f", "#51d9ed", "#ffd56a"],
    dragonball: ["#4a2408", "#1a0a02", "#9a4a12", "#ff8a32", "#ffb066"],
    yugioh: ["#2d1858", "#120826", "#5a3a9a", "#a88bff", "#ffd56a"],
  }[world];
  const w = size;
  const h = size * 1.05;
  const d = size * 0.32;
  return `
  <div style="position:absolute;left:${x}px;top:${y}px;width:${w + d}px;height:${h + d * 0.6}px;transform:rotate(${rot}deg);">
    <div style="position:absolute;left:${d * 0.9}px;top:0;width:${w}px;height:${d * 0.6}px;background:linear-gradient(135deg,${palette[2]},${palette[0]});transform:skewX(-58deg);transform-origin:left bottom;border:1px solid ${palette[4]}66;"></div>
    <div style="position:absolute;left:${w}px;top:0;width:${d}px;height:${h}px;background:linear-gradient(180deg,${palette[1]},#03060c);transform:skewY(-32deg);transform-origin:left top;margin-top:${d * 0.6}px;border:1px solid ${palette[4]}55;"></div>
    <div style="position:absolute;left:0;top:${d * 0.6}px;width:${w}px;height:${h}px;background:linear-gradient(180deg,${palette[0]},${palette[1]});border:1px solid ${palette[4]}99;box-shadow:0 40px 70px -20px rgba(0,0,0,0.85);padding:${size * 0.09}px;box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif;">
      <div style="font-size:${size * 0.055}px;letter-spacing:3px;font-weight:700;color:${palette[3]};">${sub}</div>
      <div style="margin-top:${size * 0.34}px;border:1.5px solid ${palette[3]}aa;border-radius:6px;height:${size * 0.3}px;background:${palette[3]}14;"></div>
      <div style="margin-top:${size * 0.06}px;font-size:${size * 0.105}px;line-height:1.05;font-weight:800;color:#f5f2e9;">${label}</div>
      <div style="margin-top:${size * 0.05}px;display:inline-block;background:${palette[4]};color:#17120a;font-size:${size * 0.05}px;font-weight:800;letter-spacing:1px;padding:2px 6px;border-radius:3px;">${code}</div>
    </div>
  </div>`;
}

const html = `<!doctype html><html><body style="margin:0">
<div id="og" style="width:1200px;height:630px;position:relative;overflow:hidden;background:#080c18;font-family:'Segoe UI',Arial,sans-serif;color:#f5f2e9;">
  <div style="position:absolute;inset:0;background:
       radial-gradient(48% 60% at 76% 46%, rgba(255,213,106,0.30) 0%, transparent 62%),
       radial-gradient(40% 50% at 6% 100%, rgba(81,217,237,0.14) 0%, transparent 60%),
       linear-gradient(180deg,#0a1020,#080c18);"></div>
  <div style="position:absolute;inset:0;background:repeating-linear-gradient(-28deg,transparent 0 22px,rgba(255,255,255,0.045) 22px 24px);-webkit-mask-image:linear-gradient(90deg,transparent 40%,#000 70%,transparent);"></div>
  <div style="position:absolute;left:64px;top:0;bottom:0;width:560px;display:flex;flex-direction:column;justify-content:center;">
    <div style="font-size:17px;letter-spacing:5px;text-transform:uppercase;color:#51d9ed;font-weight:700;">TCG-Gewinnspiel · Buchaktion</div>
    <div style="margin-top:20px;font-size:66px;line-height:1.02;font-weight:800;letter-spacing:-1.5px;">Ein ganzes<br/>OP-17-Case.<br/><span style="color:#ffd56a;">Vielleicht bald deins.</span></div>
    <div style="margin-top:22px;display:inline-block;border:1px solid rgba(255,213,106,0.7);background:rgba(255,213,106,0.08);color:#ffd56a;font-size:14px;font-weight:800;letter-spacing:2.5px;padding:7px 12px;border-radius:6px;width:max-content;">HAUPTGEWINN · 1 × ONE PIECE OP-17 CASE</div>
    <div style="margin-top:22px;font-size:21px;line-height:1.4;color:#b7c2d8;">3 × Fusion World Booster Box (ST01) · 3 × Magnificent Monsters EU Case · 10 × 100 € Cardmarket</div>
    <div style="margin-top:22px;display:flex;align-items:center;gap:14px;">
      <img src="${cover}" style="width:54px;height:86px;object-fit:cover;border-radius:3px;box-shadow:0 12px 24px -8px rgba(0,0,0,0.9);"/>
      <div style="font-size:19px;line-height:1.35;color:#f5f2e9;"><b>Buch kaufen · Bestellnummer eintragen</b><br/><span style="color:#b7c2d8;">„Die Lizenz zum Erfolg“ · 100 % der Autoreneinnahmen an den Kinderschutzbund</span></div>
    </div>
    <div style="margin-top:18px;font-size:16px;color:#8a97b0;">lizenzzumerfolg.com/cards · Teilnahmeschluss 05.10.2026</div>
  </div>
  ${box("dragonball", "STORY BOOSTER 01<br/>BOOSTER BOX", "FUSION WORLD", 120, 690, 300, -6, "ST01")}
  ${box("yugioh", "MAGNIFICENT<br/>MONSTERS CASE", "YU-GI-OH! TCG", 120, 1010, 300, 6, "EU VERSION")}
  ${box("onepiece", "ONE PIECE<br/>OP-17 CASE", "ONE PIECE CARD GAME", 230, 800, 150, 0, "OP-17 · CASE")}
  <div style="position:absolute;left:760px;top:520px;width:380px;height:40px;background:radial-gradient(60% 100% at 50% 50%,rgba(0,0,0,0.7),transparent 70%);"></div>
</div></body></html>`;

async function main() {
  mkdirSync("public/cards", { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.locator("#og").screenshot({ path: "public/cards/og.png", type: "png" });
  await browser.close();
  console.log("public/cards/og.png geschrieben (1200×630)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
