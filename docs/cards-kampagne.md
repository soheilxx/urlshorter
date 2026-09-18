# TCG-Gewinnspiel `/cards` – Umsetzungsdokumentation

Kampagne `cards_2026` („Deine Sammlung. Dein nächster großer Moment.“) auf
`https://lizenzzumerfolg.com/cards`. Grundlage: Kampagnenbriefing vom 18.09.2026.
Diese Datei dokumentiert Bestand, Datentrennung, Migrationsfolge, Assets,
Tracking-Matrix, Consent-Entscheidung und die tatsächlich durchgeführten Prüfungen.

## 1. Bestandsaufnahme (18.09.2026)

| Bereich | Befund |
| --- | --- |
| Gewinnspielmodell | `SweepstakesEntry` mit **global eindeutigem** `orderNumberHash` (HMAC), AES-GCM-verschlüsselte Bestellnummer, `landingPath`/`prizeScope` seit 16.09.2026. Kein Kampagnenmodell. |
| Service/Action | `submitSweepstakesEntry` + `submitSweepstakesAction` – ein Lostopf (Dubai) für `/gewinn` und `/verlosung`. |
| Admin/Export | Eine Liste, ein CSV-Export ohne Kampagnenbegriff; Gewinner nur als Status `WINNER` ohne Gewinnzuordnung. |
| Tracking | GA4 (gtag, Code-Standard `G-4EK7Q83FJ6`), Meta Pixel + CAPI, TikTok Pixel + Events API, Reddit Pixel + CAPI, LinkedIn Insight (+ CAPI nur mit `li_fat_id`), First-Party `TagEvent`. Routen-Allowlists in `book-conversion-context.ts`/`reddit-context.ts`. Consent-Modus `not-required` auf `/gewinn`/`/verlosung` (Betreiberentscheidung 17.09.2026). |
| Kurzlinks | Codes sind exakt 4 Kleinbuchstaben (`shortcode.ts`) – `/cards` kann nie mit einem Kurzlink kollidieren. |
| Assets | Buchcover (`public/gewinn/buchcover.jpg`), Autorfoto, Kinderschutzbund-Logo (`public/inbox/kinderschutzbund.svg`, Nutzungshinweise in `public/inbox/README.md`). **Keine** Produktfotos/Markenassets für OP-17, ST01, Magnificent Monsters, Cardmarket. |
| Mailer | Stub (kein Versand) – bleibt so; keine Mail wird als versendet bezeichnet. |

## 2. Routen und Änderungen

| Route | Datei | Zweck |
| --- | --- | --- |
| `/cards` | `src/app/cards/page.tsx` | Landingpage (Hero mit OP-17-Bühne, Hauptgewinn, Nebenbühnen, Ablauf, Buch/Spende, Formular, Teilen, FAQ) |
| `/cards/danke` | `src/app/cards/danke/page.tsx` | Bestätigung nur mit signiertem Receipt-Cookie; noindex + no-store (`next.config.ts`) |
| `/cards/teilnahmebedingungen` | `src/app/cards/teilnahmebedingungen/page.tsx` | Eigene Bedingungen `cards-1.0 (18.09.2026)` |
| Theme | `src/app/cards/cards.css`, `src/app/cards/layout.tsx` | Tintenblau/Gold, `--gw-*`-Mapping für das gemeinsame Formular |
| Konfiguration | `src/lib/cards-giveaway-config.ts` | 17 Gewinne, Fristen, Texte, Cardmarket-Hilfe-Link |
| Kampagnenregister | `src/lib/sweepstakes-campaign.ts` | `dubai_2026` / `cards_2026`: Wege, Bedingungsversion, Phase, Gewinnkatalog |
| Server Action | `src/actions/cards-actions.ts` | setzt Kampagne + Weg serverseitig, Receipt-Cookie, Redirect |
| Receipt | `src/lib/cards-receipt.ts` | HMAC-signiert, 20 min, httpOnly, Pfad `/cards/danke` |
| Komponenten | `src/components/cards/*` | Produktflächen (SVG), Konfetti (Canvas), Teilen, Formular-Wrapper, Danke-Client |
| OG-Bild | `scripts/generate-cards-og.ts` → `public/cards/og.png` | 1200×630 |

Weiterverwendet: `EntryForm` (neuer Prop `action`), `ParticipationHost`/`StickyCta` (Variante `cards`), `GewinnTracking` (+ `eventParams`), Collector-Routen.

## 3. Datentrennung Cards ↔ Dubai

- `SweepstakesEntry.campaignId` (`"dubai_2026" | "cards_2026"`, NOT NULL) ist Teil jeder Teilnahme.
- Eindeutigkeit: **`@@unique([campaignId, orderNumberHash])`** – dieselbe Bestellnummer je Kampagne genau einmal; die alte globale Eindeutigkeit wurde aufgehoben.
- Service `submitSweepstakesEntry` verlangt `ctx.campaign` (TypeScript + Laufzeitprüfung); ohne gültige Kennung wird nichts gespeichert – **kein Rückfall auf Dubai**. Teilnahmeweg wird nur übernommen, wenn er zur Kampagne gehört (sonst `null`).
- `submitSweepstakesAction` setzt fest `dubai_2026`; `submitCardsEntryAction` setzt fest `cards_2026` + `/cards`. Hidden Fields, UTM, Referrer haben keinen Einfluss auf den Lostopf.
- Bedingungsversion und Gewinnumfang je Kampagne (`termsVersion`, `prizeScope`), Phase je Kampagne (Cards: exklusive Grenze `2026-10-05T22:00:00.000Z`).
- Admin: Kampagnenspalte/-filter, Zähler je Kampagne, Statusänderung und Anonymisierung prüfen Objekt + Kampagne; Gewinnzuordnung (`prizeId`) nur aus dem Katalog der Kampagne des Eintrags.
- Export: genau eine Kampagne pro Export (`campaign=`), Kennung in jeder Zeile und im Dateinamen `gewinnspiel-export-<slug>-<id>-<datum>.csv`; ohne Kampagne HTTP 400.
- Ziehung: es gibt weiterhin keinen automatischen Ziehungsjob. Die Ziehung bleibt der manuelle Adminprozess (Status `WINNER` + Gewinn aus dem Kampagnenkatalog); kampagnenfremde Gewinne werden serverseitig abgelehnt.
- Rate Limit (5 Registrierungen je Client-Kennung/Stunde) ist technischer Missbrauchsschutz über alle Kampagnen – keine fachliche Regel.

### Migrationsfolge (Prisma, additiv)

1. `20260918090000_sweepstakes_campaign`: `campaignId TEXT NOT NULL DEFAULT 'dubai_2026'` (+ expliziter Backfill aller Bestandsdaten auf Dubai – vor Einführung von `/cards` gab es ausschließlich Dubai-Wege), `prizeId TEXT NULL`, Index `campaignId`, **Unique `(campaignId, orderNumberHash)`**. Der alte globale Unique bleibt in diesem Schritt.
2. `20260918090100_sweepstakes_campaign_unique_scope`: alten globalen Unique-Index entfernen, normalen Index auf `orderNumberHash` anlegen (Admin-Suche).

Rollout: Migrationen laufen vor dem Deploy. Alte Instanzen schreiben in der Übergangszeit über den DB-Default korrekt als `dubai_2026` (sie bedienen nur Dubai-Wege) und lesen `orderNumberHash` weiterhin per normaler Abfrage. Rollback-Grenze: Nach echten Cards-Einträgen darf der globale Unique **nicht** wiederhergestellt werden (Kollision derselben Bestellnummer in beiden Kampagnen). Der DB-Default kann in einer späteren Contract-Migration entfallen; der Anwendungscode setzt die Kampagne bereits immer explizit.

## 4. Assets und Herkunft

| Asset | Herkunft | Hinweis |
| --- | --- | --- |
| Buchcover | `public/gewinn/buchcover.jpg` (Original, unverändert) | Hero-Kaufblock, Buchsektion, OG-Bild |
| Kinderschutzbund-Logo | `public/inbox/kinderschutzbund.svg` (Original, siehe `public/inbox/README.md`) | Unverändert auf weißer Fläche, keine Kooperationsbehauptung |
| OP-17 Case, ST01 Booster Box, Magnificent Monsters Case, Cardmarket-Gutschein | `src/components/cards/product-art.tsx` – eigene, ausdrücklich illustrative SVG-Produktkörper mit exakter Gewinnbezeichnung | Keine Originalfotos im Projekt vorhanden; keine generative Nachbildung von Verpackungen, Logos oder Karten. Auf der Seite als „Illustration“ gekennzeichnet. Sobald der Auftraggeber freigegebene Produktfotos liefert, können sie die SVG-Flächen ersetzen. |
| OG-Bild | `public/cards/og.png` aus `scripts/generate-cards-og.ts` (Playwright-Render) | Typografie + illustrative Produktkörper + echtes Cover |

Produktzuordnung geprüft (18.09.2026): OP-17 = „BOOSTER PACK -THE WORLD'S STRONGEST WARRIORS- [OP-17]“ (en.onepiece-cardgame.com), ST01 = „STORY BOOSTER 01 [ST01]“ Fusion World (dbs-cardgame.com), „Magnificent Monsters“ (yugioh-card.com/eu). Sprachversion/Region des OP-17-Cases, Boxen je Case, Packs je Box und Marktwerte sind nicht belegt und werden nirgends behauptet. Cardmarket-Gutscheine: Einlösung laut offizieller Hilfe (`help.cardmarket.com/de/cardmarket-coupons`) im Konto, Guthaben nur für Käufe auf Cardmarket, nicht auszahlbar; Cardmarket verkauft selbst keine Gutscheine mehr (Meldung vom 13.03.2023), vergibt sie aber weiterhin als Preise – bestehende Gutscheine bleiben gültig.

## 5. Tracking-Matrix `/cards` (+ `/cards/danke`)

| Anbieter | Modul | Browserpfad | Serverpfad | Event-Mapping | Consent | Dedup | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GA4 `G-4EK7Q83FJ6` | `GewinnTracking` (gtag.js) | `page_view`, `cards_seite`, CTA-Events (`cards_cta_*`, `cards_formular_geoeffnet`, `cards_link_kopiert`, `cards_teilen_*`), `add_to_cart` (Amazon-Outbound-Proxy, Item = Buch 18 €, `quantity: 1`), `gewinnspiel_teilnahme` | – | Parameter `giveaway_campaign=cards_2026`, `landing_path`, `merchant`, `cta_position`, `conversion_semantics=amazon_outbound_proxy`, `product_type=book` | not-required | GA4-intern | Lokal (E2E) verifiziert, Live-Verifikation nach Deploy |
| Meta Pixel + CAPI | `BookConversionTracking` / `/api/book/events` | `PageView`, `AddToCart` (custom_data Buch + Semantik) | CAPI `PageView`, `AddToCart` mit derselben `event_id` | `content_category`/`giveaway_campaign` = Kampagne | not-required | `event_id` = Browser-UUID, `TagEvent`-Unique | Pixel-ID/Token aus Dashboard/Env; lokal Beacons 204 |
| Meta Registrierung | `trackRegistrationCompleted` / `registration-conversion.ts` | `CompleteRegistration` mit Server-Ereignis-ID | CAPI `CompleteRegistration`, dieselbe ID | nur nach echter Persistenz (Receipt mit `trackingEventId`) | not-required | ID-Dedup + `TagEvent`-Unique + Browser-Nonce | lokal verifiziert |
| TikTok Pixel + Events API | wie Meta | `AddToCart`, `CompleteRegistration` | Events API mit `event_id` | `description=amazon_outbound_proxy:cards_2026` | not-required | `event_id` | Token aus Dashboard/Env |
| Reddit Pixel + CAPI | `RedditTracking` / `/api/reddit/events` | `PageVisit`, `AddToCart` | CAPI mit `conversionId` | – | not-required | `conversionId` | lokal Beacons 204 |
| LinkedIn Insight + CAPI | `GewinnTracking`/`BookConversionTracking` | `lintrk('track', {conversion_id})` bei Amazon-Klick | CAPI nur mit `li_fat_id` | bestehende Conversion-Regel | not-required | `event_id` | wie Bestand |
| First-Party `TagEvent` | Collector-Routen | – | `book_page_view`, `book_add_to_cart`, `reddit_*`, `sweepstakes_registration` mit `path=/cards` | – | – | Unique-ID | lokal verifiziert |

Amazon-Klick = **Amazon-Outbound / AddToCart-Proxy** an allen Positionen (`hero_amazon`, `hero_cover_amazon`, `gewinne_amazon`, `buch_amazon`, `buch_cover_amazon`, `abschluss_amazon`, `sticky_amazon`). Nie `Purchase`, nie Umsatz; Wert nur der Buchpreis. Keine Formulardaten in Events (Allowlist-Payloads).

## 6. Consent-Entscheidung

Das Briefing warnt davor, `consentMode="not-required"` unbesehen zu übernehmen. Der Betreiber (Wiresoft Portal Ltd.) hat am 17.09.2026 für die Kampagnenseiten ausdrücklich entschieden: „Alle Events müssen immer feuern.“ Diese Entscheidung wurde für `/cards` bewusst übernommen (`ENTRY_PATH_CONSENT_MODE["/cards"] = "not-required"`, Seiten-`consentMode="not-required"`). Das First-Party-Consent-Banner (`src/components/consent-banner.tsx`) bleibt im Code; ein Consent-Gate ist per `"required"` an drei Stellen (Seite, Danke-Seite, `ENTRY_PATH_CONSENT_MODE`) wieder aktivierbar. Ein „Cookie-Einstellungen“-Link entfällt daher im Footer; Datenschutz/Impressum sind verlinkt.

## 7. Fristen (durchgängig aus `cards-giveaway-config.ts`)

- Teilnahmeschluss UI: **05.10.2026, 23:59 Uhr (MESZ)** – Hero, Formularhinweis, FAQ, Bedingungen.
- Serverseitige exklusive Grenze: **06.10.2026 00:00:00 MESZ = 2026-10-05T22:00:00.000Z** (`getCardsPhase`, Integrationstest: 23:59:59.999 zählt, 00:00:00 nicht).
- Gewinnerbekanntgabe: **12.10.2026** ohne Uhrzeit (Phase `announced` ab Tagesbeginn Europe/Berlin; keine automatische Ziehung).
- Nach Schluss: Hero-Status „Teilnahme beendet · Gewinnerbekanntgabe: 12.10.2026“, Formularbereich mit Endstatus, keine Teilnahme-CTAs, Share-Text für die beendete Aktion, Buchlinks bleiben.

## 8. Durchgeführte Prüfungen (18.09.2026, lokal)

- Unit (`npm test`): 390 Tests grün – u. a. Gewinnmengen (1/3/3/10 = 17, 1.000 €), Fristgrenzen, Kampagnenregister ohne Fallback, Receipt-Signatur/Ablauf/Manipulation.
- Integration (`npm run test:integration`, Test-DB): 99 Tests grün – Cards-Eintrag nur in Cards, Dubai unverändert; dieselbe Nummer je Kampagne einmal; Wettlauf derselben Nummer → genau ein Los; zwei echte Nummern → zwei Lose; kein Fallback ohne Kampagne; Honeypot ohne Ereignis-ID; Fristgrenze 23:59:59.999/00:00:00.
- E2E (`playwright test e2e/cards.spec.ts e2e/verlosung.spec.ts e2e/gewinn.spec.ts`, Produktions-Build, Test-DB): 21 Tests grün – Rendering/Mengen/EU-Version/Termine, Tracking-Kette (PageView-Beacons 204, GA4 `cards_seite`, AddToCart-Proxy mit Kampagnensemantik an Buch- und Reddit-Collector, kein Purchase), Registrierung → `/cards/danke` mit einmaligem Konfetti und `CompleteRegistration` (UUID, ohne Formulardaten), Reload ohne Feier, Direktaufruf ohne Receipt, weitere Bestellnummer (neue Feier, reduced motion statisch), Duplikat, Honeypot ohne Event, Kampagnentrennung im Admin + Export (400 ohne Kampagne, Dateiname mit Kennung), Bedingungen, Overflow 320 px, Sticky-Bar, Screenshots 390/768/1440.
- Schema: `prisma migrate diff` (Test-DB ↔ Schema) ohne Differenz; Indizes `SweepstakesEntry_campaignId_orderNumberHash_key` (unique) vorhanden, `SweepstakesEntry_orderNumberHash_key` entfernt.
- Screenshots: `test-results/screenshots/cards-{390,768,1440}.png`, `cards-bedingungen-1440.png` (werden je E2E-Lauf neu erzeugt).

Nicht gemessen/behauptet: Lighthouse-Scores, Live-Conversions bei den Werbeplattformen.

## 9. Produktionsmigration und Deploy

Reihenfolge laut Projekt-Workflow: Counts vor der Migration festhalten → `prisma migrate deploy` gegen `DATABASE_URL_UNPOOLED` → Counts nach der Migration (alle Bestandsdaten `campaignId = dubai_2026`) → Push auf `main` (Vercel-Deploy) → Live-Verifikation `/cards`, `/cards/danke` (ohne Receipt: neutraler Hinweis), `/cards/teilnahmebedingungen`, `/gewinn`, `/verlosung`, `/gutschein`. Das Ergebnis dieser Schritte steht im Abschlussbericht.
