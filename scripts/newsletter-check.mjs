#!/usr/bin/env node
/**
 * Zustellbarkeits- und Spam-Vorprüfung für Newsletter-HTML (ohne externe Dienste).
 *
 *   node scripts/newsletter-check.mjs public/newsletter/verlosung-adcloud.html docs/newsletter-verlosung-adcloud.txt
 *
 * Prüft heuristisch, was Filter wie SpamAssassin, Gmail und Outlook bewerten:
 * Größe (Gmail-Clipping), Text-/Bild-Verhältnis, Bilder mit alt/width/height
 * und absoluter https-URL, verbotene Elemente (script/form/iframe), Link-
 * Hygiene (nur bekannte Domains, keine URL-Kürzer, kein javascript:), Preheader,
 * Titel, Pflichtangaben (Abmeldung, Impressum, Anschrift), Spam-Triggerwörter,
 * Großschreibung/Ausrufezeichen, Ziel-URLs erreichbar (HEAD) und dass die
 * Textversion dieselben Ziel-URLs enthält.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const [, , htmlPath, textPath] = process.argv;
if (!htmlPath) {
  console.error("Aufruf: node scripts/newsletter-check.mjs <html> [text]");
  process.exit(2);
}

const html = readFileSync(resolve(htmlPath), "utf8");
const text = textPath ? readFileSync(resolve(textPath), "utf8") : null;

const findings = [];
const ok = (msg) => findings.push({ level: "ok", msg });
const warn = (msg) => findings.push({ level: "warn", msg });
const fail = (msg) => findings.push({ level: "fail", msg });

// --- Größe ------------------------------------------------------------------
const bytes = Buffer.byteLength(html, "utf8");
if (bytes > 102 * 1024) fail(`HTML ${(bytes / 1024).toFixed(1)} KB > 102 KB (Gmail schneidet ab)`);
else ok(`HTML-Größe ${(bytes / 1024).toFixed(1)} KB (< 102 KB Gmail-Limit)`);

// --- Sichtbarer Text -------------------------------------------------------
const stripped = html
  .replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&zwnj;/g, " ")
  .replace(/&[a-z]+;|&#\d+;/gi, "x")
  .replace(/\s+/g, " ")
  .trim();
const words = stripped.split(" ").filter((w) => /[a-zäöüß0-9]/i.test(w));
ok(`Sichtbarer Text: ${words.length} Wörter`);

// --- Bilder ----------------------------------------------------------------
const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
let imgIssues = 0;
for (const tag of imgs) {
  const src = /src="([^"]+)"/i.exec(tag)?.[1] ?? "";
  if (!/^https:\/\//i.test(src)) (imgIssues++, fail(`Bild ohne absolute https-URL: ${src}`));
  if (!/\balt="/i.test(tag)) (imgIssues++, fail(`Bild ohne alt-Attribut: ${src}`));
  if (!/\bwidth="\d+"/i.test(tag) || !/\bheight="\d+"/i.test(tag))
    (imgIssues++, warn(`Bild ohne feste width/height: ${src}`));
}
if (imgs.length === 0) warn("Keine Bilder – reine Textmail wirkt bei Deal-Empfängern weniger attraktiv");
else if (!imgIssues) ok(`${imgs.length} Bilder, alle mit alt, width/height und https-URL`);
const imageWordRatio = imgs.length / Math.max(1, words.length / 100);
if (words.length < 200) fail(`Zu wenig Text (${words.length} Wörter) im Verhältnis zu Bildern`);
else ok(`Text-/Bild-Verhältnis: ${imgs.length} Bilder auf ${words.length} Wörter (${imageWordRatio.toFixed(2)} Bilder je 100 Wörter)`);

// --- Verbotene Elemente ----------------------------------------------------
for (const [re, label] of [
  [/<script\b/i, "<script>"],
  [/<form\b/i, "<form>"],
  [/<iframe\b/i, "<iframe>"],
  [/<embed\b|<object\b/i, "<embed>/<object>"],
  [/javascript:/i, "javascript:-URL"],
  [/<link\b[^>]*stylesheet/i, "externes Stylesheet"],
  [/@import/i, "@import"],
  [/<input\b|<button\b/i, "Formularelemente"],
]) {
  if (re.test(html)) fail(`Verbotenes Element/Konstrukt: ${label}`);
}
ok("Keine Skripte, Formulare, iframes oder externen Stylesheets");

// --- Struktur ----------------------------------------------------------------
if (!/^<!doctype html>/i.test(html.trim())) warn("Kein HTML5-Doctype");
if (!/<html[^>]*\blang="de"/i.test(html)) warn("Kein lang=\"de\" am <html>");
if (!/<title>[^<]{10,}<\/title>/i.test(html)) fail("Kein aussagekräftiger <title>");
else ok("<title> vorhanden");
if (!/<meta charset="utf-8">/i.test(html)) fail("Kein <meta charset=\"utf-8\">");
const preheader = /mso-hide:all[^>]*>\s*([^<]{20,})/i.exec(html)?.[1]?.trim();
if (!preheader) warn("Kein versteckter Preheader gefunden");
else {
  const len = preheader.replace(/&[a-z]+;/g, "x").length;
  if (len < 40 || len > 130) warn(`Preheader-Länge ${len} Zeichen (empfohlen 40–130)`);
  else ok(`Preheader vorhanden (${len} Zeichen)`);
}
const tables = (html.match(/<table\b/gi) ?? []).length;
const tablesClosed = (html.match(/<\/table>/gi) ?? []).length;
if (tables !== tablesClosed) fail(`Unausgeglichene Tabellen: ${tables} <table> vs. ${tablesClosed} </table>`);
else ok(`${tables} Tabellen, alle geschlossen`);
const tds = (html.match(/<td\b/gi) ?? []).length;
const tdsClosed = (html.match(/<\/td>/gi) ?? []).length;
if (tds !== tdsClosed) fail(`Unausgeglichene Zellen: ${tds} <td> vs. ${tdsClosed} </td>`);
const presentational = (html.match(/<table\b[^>]*role="presentation"/gi) ?? []).length;
if (presentational < tables) warn(`${tables - presentational} Layout-Tabellen ohne role="presentation"`);
else ok('Alle Tabellen mit role="presentation"');
const width = /width="(\d+)"\s+class="fluid"/.exec(html)?.[1];
if (!width || Number(width) > 640) warn(`Container-Breite ${width ?? "unbekannt"} (empfohlen 600–640 px)`);
else ok(`Container-Breite ${width} px`);

// --- Links --------------------------------------------------------------------
const hrefs = [...html.matchAll(/href="([^"]+)"/gi)].map((m) => m[1].replace(/&amp;/g, "&"));
const allowedHosts = new Set(["lizenzzumerfolg.com", "soheil-hosseini.de", "www.soheil-hosseini.de"]);
const shorteners = /\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|cutt\.ly)\b/i;
const externalLinks = [];
for (const href of hrefs) {
  if (href.startsWith("mailto:")) continue;
  if (href.startsWith("#ADCLOUD_")) continue; // Versandsystem-Platzhalter
  if (href.startsWith("#")) (warn(`Leerer Anker-Link: ${href}`));
  try {
    const u = new URL(href);
    if (u.protocol !== "https:") fail(`Kein https-Link: ${href}`);
    if (shorteners.test(u.hostname)) fail(`URL-Kürzer (Spam-Signal): ${href}`);
    if (!allowedHosts.has(u.hostname)) warn(`Fremde Domain verlinkt: ${u.hostname}`);
    externalLinks.push(href);
  } catch {
    if (!href.startsWith("#")) fail(`Ungültiger Link: ${href}`);
  }
}
const uniqueLinks = [...new Set(externalLinks)];
ok(`${hrefs.length} Links, ${uniqueLinks.length} eindeutige Ziel-URLs, Domains: ${[...new Set(uniqueLinks.map((l) => new URL(l).hostname))].join(", ")}`);
const utmLinks = uniqueLinks.filter((l) => l.includes("/verlosung") && !l.includes("/newsletter/"));
const missingUtm = utmLinks.filter((l) => !/utm_source=adcloud/.test(l) || !/utm_campaign=/.test(l));
if (missingUtm.length) fail(`Kampagnenlinks ohne UTM: ${missingUtm.join(", ")}`);
else ok(`${utmLinks.length} Kampagnenlinks mit UTM (utm_term je Position)`);
if (/href="[^"]*(email|e-mail|name|vorname)=/i.test(html)) fail("Personenbezogene Parameter in Links");

// --- Pflichtangaben ------------------------------------------------------------
if (!/ADCLOUD_UNSUBSCRIBE|abbestellen|abmelden/i.test(html)) fail("Kein Abmeldelink");
else ok("Abmeldelink/Platzhalter vorhanden");
if (!/impressum/i.test(html)) fail("Kein Impressum-Link");
else ok("Impressum verlinkt");
if (!/Teilnahmebedingungen/.test(html)) fail("Teilnahmebedingungen nicht verlinkt");
else ok("Teilnahmebedingungen verlinkt");
if (!/Datenschutz/.test(html)) warn("Datenschutzhinweise nicht verlinkt");
if (!/Vereinigte Arabische Emirate|Dubai International Financial Centre/.test(html))
  fail("Postanschrift des Veranstalters fehlt");
else ok("Veranstalter mit Anschrift genannt");

// --- Spam-Trigger ------------------------------------------------------------------
const triggers = [
  /\bkostenlos\b/i, /\bgratis\b/i, /\bgeschenkt\b/i, /100\s?% (kostenlos|gratis|sicher)/i,
  /\bSie haben gewonnen\b/i, /\bdu hast gewonnen\b/i, /\bGewinner:in\b/i, /\bHerzlichen Glückwunsch\b/i,
  /\bklick(e|en Sie) hier\b/i, /\bnur heute\b/i, /\bnur noch heute\b/i, /\bletzte Chance\b/i, /\bdringend\b/i,
  /\bgarantiert\b/i, /\brisikofrei\b/i, /\bGeld verdienen\b/i, /\breich werden\b/i, /\bsofort Bargeld\b/i,
  /\bfree\b/i, /\bwinner\b/i, /\bcongratulations\b/i, /\bclick here\b/i, /\bact now\b/i, /\blimited time\b/i,
  /\bcash\b/i, /\$\$\$/, /€€€/, /!!!/, /\?\?\?/, /\bGewinnchance verdoppeln\b/i, /\bsicher gewinnen\b/i,
];
const hits = triggers.map((re) => stripped.match(re)?.[0]).filter(Boolean);
if (hits.length) warn(`Spam-Triggerwörter im Text: ${[...new Set(hits)].join(", ")}`);
else ok("Keine typischen Spam-Triggerwörter im sichtbaren Text");
const exclamations = (stripped.match(/!/g) ?? []).length;
if (exclamations > 3) warn(`${exclamations} Ausrufezeichen (empfohlen ≤ 3)`);
else ok(`${exclamations} Ausrufezeichen`);
const capsWords = words.filter((w) => w.length > 3 && /^[A-ZÄÖÜ]+$/.test(w));
if (capsWords.length > 5) warn(`${capsWords.length} Wörter in Großbuchstaben im Quelltext: ${capsWords.slice(0, 8).join(", ")}`);
else ok(`Großschreibung nur ${capsWords.length} Wörter (Kicker laufen über CSS text-transform)`);
const currencyMentions = (stripped.match(/€/g) ?? []).length + (html.match(/&euro;/g) ?? []).length;
ok(`${currencyMentions} Euro-Nennungen (Beträge sind Kerninhalt der Aktion, kein Massen-Preis-Spam)`);
if (/font-size:\s*[0-9]px|font-size:\s*1px;[^"]*color:#(?!fbefd8)/i.test(stripped)) warn("Verdächtig kleine Schrift");
const hiddenText = (html.match(/display:none/gi) ?? []).length;
if (hiddenText > 2) warn(`${hiddenText}× display:none (nur Preheader ist üblich)`);
else ok(`display:none nur ${hiddenText}× (Preheader)`);
if (/color:#ffffff;[^"]*background-color:#ffffff/i.test(html)) warn("Weißer Text auf weißem Grund (Spam-Signal)");

// --- Textversion --------------------------------------------------------------------
if (text) {
  const textLinks = [...text.matchAll(/https?:\/\/\S+/g)].map((m) => m[0].replace(/[).,]+$/, ""));
  const htmlTargets = new Set(uniqueLinks.map((l) => l.replace(/[?#].*$/, "")));
  const textTargets = new Set(textLinks.map((l) => l.replace(/[?#].*$/, "")));
  const missing = [...htmlTargets].filter((t) => !textTargets.has(t) && !t.includes("/newsletter/"));
  if (missing.length) warn(`Textversion ohne diese Ziel-URLs: ${missing.join(", ")}`);
  else ok(`Textversion enthält alle Ziel-URLs (${textTargets.size})`);
  if (!/ADCLOUD_UNSUBSCRIBE/.test(text)) fail("Textversion ohne Abmelde-Platzhalter");
  const textWords = text.split(/\s+/).filter(Boolean).length;
  ok(`Textversion: ${textWords} Wörter`);
} else {
  warn("Keine Textversion übergeben (Multipart-Alternative empfohlen)");
}

// --- Erreichbarkeit der Ziele (HEAD) ------------------------------------------------
async function head(url) {
  try {
    const res = await fetch(url, { method: "GET", redirect: "manual", headers: { "user-agent": "newsletter-check/1.0" } });
    return res.status;
  } catch (e) {
    return `Fehler: ${e.message}`;
  }
}
const targets = [...new Set([...uniqueLinks.map((l) => l.replace(/#.*$/, "")), ...imgs.map((t) => /src="([^"]+)"/i.exec(t)[1])])];
for (const target of targets) {
  const status = await head(target);
  if (status === 200) ok(`200 ${target}`);
  else if (typeof status === "number" && status >= 300 && status < 400) warn(`${status} (Redirect) ${target}`);
  else fail(`${status} ${target}`);
}

// --- Ausgabe ------------------------------------------------------------------------------
const icon = { ok: "✓", warn: "!", fail: "✗" };
for (const f of findings) console.log(`${icon[f.level]} ${f.msg}`);
const fails = findings.filter((f) => f.level === "fail").length;
const warns = findings.filter((f) => f.level === "warn").length;
console.log(`\n${fails} Fehler, ${warns} Hinweise, ${findings.length - fails - warns} OK`);
process.exit(fails ? 1 : 0);
