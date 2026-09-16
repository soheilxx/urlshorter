# Kampagnenseite `/verlosung` – Umsetzung, Tracking-Matrix, offene Punkte

Stand: 16.09.2026 · Briefing: „Dubai für zwei. Und 300 Gutscheine zu gewinnen.“
(Adcloud-Mailing, 500.000 B2C-Empfänger). Produktions-URL:
`https://lizenzzumerfolg.com/verlosung`.

## 1. Bestandsübersicht und Wiederverwendung

| Bereich | Wiederverwendet | Geändert / neu |
| --- | --- | --- |
| Konfiguration | `src/lib/gewinnspiel-config.ts`, `src/lib/buch-config.ts` | `VOUCHER_BRANDS` (9 Staffeln, Summen berechnet), `TOTAL_PRIZE_VALUE_*`, `PRIZE_SCOPE`, `ENTRY_PATHS`, `VERLOSUNG_URL`, Share-Texte, `RETAILER_LINKS`, `ELIGIBLE_COUNTRY_ALIASES`, `TERMS_VERSION` → 1.3; `buchKaufLabels()` (CTA-Wortlaut „Jetzt bei Amazon bestellen“ – bewusst ohne vorbestellen/kaufen) |
| Formular | `src/components/gewinn/entry-form.tsx` (Felder, Fehler, Honeypot, Token) | Props `landingPath`, `submitLabel`, `termsHref`, `submitHint`, `renderSuccess`; Farben nur über `--gw-*`-Variablen; Registrierungsevent nur mit Server-Ereignis-ID |
| Server Action | `src/actions/sweepstakes-actions.ts` → `submitSweepstakesAction` | liest `landingPath`, gibt `trackingEventId` zurück, startet Server-Registrierungsevent in `after()`; neu `newFormTokenAction` |
| Kernlogik | `src/lib/sweepstakes.ts` → `submitSweepstakesEntry` | validiert `landingPath` gegen `ENTRY_PATHS`, Land gegen DE/AT/CH-Werteliste, speichert `landingPath` + `prizeScope`, Rückgabe `persisted`/`trackingEventId` |
| Validierung | `src/lib/sweepstakes-validation.ts` | `normalizeCountry`, `COUNTRY_NOT_ELIGIBLE_MESSAGE` |
| Datenmodell | `prisma/schema.prisma` `SweepstakesEntry` | additiv: `landingPath String?`, `prizeScope String?`, Index; Migration `20260916120000_sweepstakes_landing_path` |
| Admin/Export | `src/app/admin/gewinnspiel/*`, `src/app/api/export/sweepstakes/route.ts`, `src/lib/sweepstakes-admin.ts` | Spalte/Filter „Teilnahmeweg“, Detailzeilen „Teilnahmeweg“/„Gewinnumfang“, CSV-Spalten `UTM Content`, `Teilnahmeweg`, `Gewinnumfang` |
| Bedingungen | `src/app/gewinn/teilnahmebedingungen/page.tsx` | §1 Markenhinweis, §2 alle drei Gutscheinmarken + Versionsabsatz 1.3, §3 `/verlosung` als Teilnahmeweg + Los-Regel, §5 Reihenfolge bei gleichem Gutscheinwert |
| Tracking-Einstieg | `src/components/gewinn/gewinn-tracking.tsx` | reagiert auf `lze-consent-change` ohne Reload |
| Allowlisten | `src/lib/book-conversion-context.ts`, `src/lib/reddit-context.ts` | `/verlosung` ergänzt |
| Collector | `src/app/api/book/events/route.ts`, `src/app/api/reddit/events/route.ts` | Consent-Cookie-Auflösung über `resolveConsentCookie` (Banner-Default `lze_marketing_consent`) |
| Browser-Pixel | `src/components/book-conversion-tracking.tsx` | ein PageView je Seitenaufruf auch bei Consent-Widerruf/-Neuzustimmung (`__lzeBookPageViews`) |
| Consent | `src/lib/consent.ts` | Konstanten + `resolveConsentCookie`, `readCookieValue`, `consentDecisionFromValue`; neu `src/components/consent-banner.tsx` |
| Registrierungsevent | – | neu `src/lib/registration-conversion.ts`, `trackRegistrationCompleted()` in `src/lib/gewinn-analytics.ts` |
| Seite | `src/app/gewinn/page.tsx` als technische Referenz | neu `src/app/verlosung/page.tsx`, `src/components/verlosung/{share-box,sticky-cta,confetti,verlosung-entry,participation-host}.tsx` (participation-host: jeder `#teilnehmen`-Link öffnet das eine Formular sofort im Dialog; alle Bestell-CTAs verlinken direkt zu Amazon – Conversion-Regel vom 16.09.2026: kein CTA springt auf der Seite), `.verlosung-theme` in `globals.css` |

## 2. Tracking-/CAPI-Integrationsmatrix für `/verlosung`

Consent-Modus der Seite: **`required`** – Marketing-Pixel und Server-Events
laufen nur mit Cookie `lze_marketing_consent=accepted` (bzw. dem per Env
konfigurierten Cookie). Ohne Entscheidung oder bei „Nur notwendige“ wird
kein Drittanbieter-Skript geladen und kein Beacon/CAPI-Event gesendet; die
Teilnahme funktioniert unabhängig davon.

| Anbieter | Modul | Browserpfad | Serverpfad | Consent | Events | Teststatus |
| --- | --- | --- | --- | --- | --- | --- |
| Meta Pixel + CAPI | `book-conversion-tracking.tsx`, `/api/book/events`, `registration-conversion.ts`, `tag-capi.ts` | `PageView`, `AddToCart` (Händlerklick, Kauf-Proxy), `CompleteRegistration` (`fbq('track')`) | `TagEvent` + CAPI mit identischer `event_id` | Cookie erforderlich | PageView / AddToCart / CompleteRegistration | Unit (Mocks), E2E (First-Party-Kette, Pixel-Queue-Abgleich der Event-IDs); Live-CAPI mit Produktions-Token nach Deploy per Logs `book_capi.meta_sent` / `registration_capi.meta_sent` verifizieren |
| TikTok Pixel + Events API | dieselben Module | `Pageview`, `AddToCart`, `CompleteRegistration` (`ttq.track`) | Events API `AddToCart`, `CompleteRegistration` mit `event_id` | Cookie erforderlich | wie links | Unit (Mocks), E2E-Bootstrap; live nach Deploy per Log `registration_capi.tiktok_sent` |
| LinkedIn Insight Tag + CAPI | `gewinn-tracking.tsx`, `/api/book/events`, `linkedin-capi.ts` | Insight Tag, Conversion beim Händlerklick | CAPI nur mit `li_fat_id` | Cookie erforderlich | Händlerklick (bestehende Regel 30352953) | unverändert; Registrierung bewusst **nicht** (bräuchte eigene Conversion-Regel, s. offene Punkte) |
| Reddit Pixel + CAPI | `reddit-tracking.tsx`, `/api/reddit/events` | `PageVisit`, Amazon-Outbound | CAPI mit `event_id` | Cookie erforderlich | Landingpage-Aufruf, Amazon-Klick | Allowlist-Unit-Test; Route unverändert |
| GA4 / GTM | `gewinn-tracking.tsx` | dataLayer `verlosung_seite`, CTA-Events (`verlosung_cta_*`, `verlosung_sticky_*`), `gewinnspiel_formular_start`, `gewinnspiel_teilnahme` (+`event_id`), `verlosung_formular_geoeffnet`, `verlosung_link_kopiert`, `verlosung_teilen_geoeffnet`, `verlosung_weitere_bestellnummer` | – | Cookie erforderlich | nur Event-Namen, keine Formulardaten | nicht live (keine GA4/GTM-ID in Produktion gesetzt) |
| First-Party | `TagEvent` | Beacons | `book_page_view`, `book_add_to_cart`, `sweepstakes_registration`, `reddit_*` | wie oben | – | Unit + Integration + E2E |

Semantik: Händlerklick = `AddToCart` (bestehender Kaufinteresse-Proxy, kein
Umsatz, nie `Purchase`). `CompleteRegistration` = Anmeldung eingegangen, keine
Kaufverifikation, kein Wert. Kopieren/Teilen nur im Analyse-Modell
(dataLayer/GA4), keine Werbe-Conversion. Honeypot-Scheinerfolg liefert keine
Ereignis-ID → weder Browser- noch Server-Event.

## 3. Offene Geschäfts-/Konfigurationspunkte (nicht erfunden, bewusst offen)

| # | Punkt | Wo hinterlegen | Aktueller Stand auf der Seite |
| --- | --- | --- | --- |
| 1 | **Einlösebedingungen Bikinilista- und Amazon-Gutscheine**: Einlöseshop/-gebiet (Bikinilista-Shop-URL, Amazon-Marktplatz `amazon.de`?), Gültigkeitsdauer, Mindestbestellwert, Kombinierbarkeit | `VOUCHER_BRANDS[].shopUrl` (derzeit `null`), Text in `teilnahmebedingungen/page.tsx` §2 und FAQ „Welche Einlösebedingungen haben die Gutscheine?“ | „Gültigkeitsdauer und weitere Einlösebedingungen werden zusammen mit dem Gutschein mitgeteilt“ – keine Aussage zu Mindestbestellwert/Kombinierbarkeit |
| 2 | **Gültigkeitsdauer der Wiresoft-Gutscheine** (bereits seit 1.2 offen) | wie 1 | wie 1 |
| 3 | **Ziehungsreihenfolge bei gleichem Gutscheinwert** über Marken hinweg | §5 der Bedingungen | eingesetzt: „Wertgutscheine gleichen Werts werden in zufälliger Reihenfolge der Marken vergeben“ – bitte vom Veranstalter bestätigen oder ersetzen |
| 4 | **Bikinilista- und Amazon-Logos** (zulässige Assets) | `public/…`, Gutscheinkarten in `verlosung/page.tsx` | Markennamen als Text (bewusst, keine erfundenen Assetpfade) |
| 5 | **Bestätigungs-E-Mail**: `src/lib/mailer.ts` ist ein Stub | `MAIL_FROM` + `RESEND_API_KEY` oder `SMTP_URL` + echte Implementierung | Seite verspricht keinen Versand; Referenz wird angezeigt und ist kopierbar |
| 6 | **LinkedIn-Conversion für Registrierungen** | neue Conversion-Regel im LinkedIn Campaign Manager, dann `registration-conversion.ts` erweitern | nicht gesendet (Regel 30352953 bildet den Händlerklick ab) |
| 7 | **LinkedIn-CAPI-Token** läuft ca. Ende Oktober 2026 ab | Vercel Env `LINKEDIN_CAPI_ACCESS_TOKEN` | unverändert |
| 8 | **GA4/GTM** für `/verlosung` | `GA4_MEASUREMENT_ID` / `GTM_CONTAINER_ID` oder Dashboard → Websites | nicht gesetzt → dataLayer-Events ohne Empfänger |
| 9 | **Consent-Modus `/gewinn` und `/buch-inbox`** weiterhin `not-required` (Betreiber-Entscheidung 28.08.2026) | `src/app/gewinn/page.tsx`, `src/app/buch-inbox/page.tsx` | unverändert; das neue Banner + `required` ließe sich dort mit zwei Zeilen übernehmen |
| 10 | **Datenschutzerklärung** (extern, `PRIVACY_URL`) sollte das First-Party-Consent-Cookie `lze_marketing_consent` und die Pixel-Anbieter nennen | externe Seite soheil-hosseini.de/datenschutz | Banner verlinkt die bestehende Erklärung |

## 4. Prüfungen (siehe Abschlussbericht im Chat / CI)

`npm run typecheck`, `npm run lint`, `npm test` (Unit), `npm run test:integration`,
`npm run build`, `npx playwright test e2e/verlosung.spec.ts e2e/gewinn.spec.ts`.
Screenshots (390 px, 1440 px) entstehen im E2E-Lauf unter `test-results/`.
