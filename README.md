# urlshorter – Kurzlink-Tracking für `lizenzzumerfolg.com`

Redirect- und Tracking-System für Kurzlinks mit **beliebigen HTTPS-Zielen**
(Amazon-Produktseiten, Landingpages, Shops …). Auf Zielseiten wie Amazon
können keine eigenen Pixel installiert werden – dieses System misst den Klick
deshalb **vor** der Weiterleitung: Ein Besucher ruft z. B.
`https://lizenzzumerfolg.com/abcd` auf, der Klick wird serverseitig erfasst,
eine minimale Weiterleitungsseite („Bridge-Page“) stößt die konfigurierten
Tracking-Pixel an und leitet danach automatisch zur hinterlegten Ziel-URL
weiter. Die Domain `lizenzzumerfolg.com` wird ausschließlich für dieses
Tracking-Projekt genutzt.

---

## Inhalt

1. [Architektur](#architektur)
2. [Lokale Installation](#lokale-installation)
3. [Datenbankeinrichtung](#datenbankeinrichtung)
4. [Environment Variables](#environment-variables)
5. [Admin-Passwort-Hash erzeugen](#admin-passwort-hash-erzeugen)
6. [Benutzer & Rollen](#benutzer--rollen)
7. [Analytics-Tab (Geo & Kanäle)](#analytics-tab-geo--kanäle)
8. [Migrationen](#migrationen)
9. [Tests](#tests)
8. [Deployment auf Vercel](#deployment-auf-vercel)
9. [Domain und DNS](#domain-und-dns)
10. [Tracking-Konfiguration](#tracking-konfiguration)
11. [Consent-Konfiguration (DSGVO)](#consent-konfiguration-dsgvo)
12. [Datenschutz-Hinweise](#datenschutz-hinweise)
13. [Bot-Erkennung](#bot-erkennung)
14. [Datenaufbewahrung](#datenaufbewahrung)
15. [Backup-Hinweise](#backup-hinweise)
16. [Fehlerbehebung](#fehlerbehebung)
17. [Grenzen der Messbarkeit](#grenzen-der-messbarkeit)

---

## Architektur

**Stack:** Next.js 15 (App Router) · TypeScript (strict) · PostgreSQL ·
Prisma ORM · Tailwind CSS 4 · Recharts · Zod · Vitest · Playwright · Vercel

### Ablauf eines Kurzlink-Aufrufs (`GET /{code}`)

1. Code-Validierung (exakt 4 Kleinbuchstaben a–z).
2. Kurzlink + Destination werden mit **einer** Datenbankabfrage geladen.
3. Unbekannt/deaktiviert/abgelaufen → saubere Fehlerseite (404/410), **keine** Weiterleitung.
4. Bot-Klassifizierung (User-Agent, HEAD, Prefetch-Header).
5. Click-Event wird serverseitig gespeichert (via `after()` **nach** der Response –
   kostet den Besucher keine Zeit).
6. **Bots:** direkter 302-Redirect zur Ziel-URL (keine Pixel nötig).
   **Menschen:** minimale Bridge-Page (Status 200, wenige KB Inline-HTML/CSS/JS,
   kein React, keine Bilder/Fonts):
   - `dataLayer`-Initialisierung + Google Consent Mode v2,
   - je nach Consent: GTM / GA4 / Meta Pixel mit Event `amazon_outbound_click`,
   - Beacons an `/api/beacon` (signiertes Event-Token): Bridge geladen,
     Tracking angestoßen, Redirect gestartet, manueller Klick,
   - nach konfigurierbarer Verzögerung (300–2000 ms, Standard 900 ms):
     `window.location.replace(amazonUrl)`,
   - sichtbarer Fallback-Button („Jetzt zu Amazon“ bei Amazon-Zielen, sonst
     „Jetzt zu &lt;hostname&gt;“), `<noscript>`-Meta-Refresh,
   - Links zu Datenschutz und Impressum.
7. Die Route sendet strikte `Cache-Control: no-store`-Header (inkl.
   `Vercel-CDN-Cache-Control`) – jeder Aufruf wird serverseitig verarbeitet.

**Fehlerphilosophie:** Sobald der Kurzlink geladen ist, hat die Erreichbarkeit
des Ziels Priorität. Scheitert irgendetwas danach (Datenbank, Einstellungen,
Token), wird der Fehler strukturiert geloggt und der Besucher direkt per 302
weitergeleitet – ein Trackingfehler kostet nie einen Kauf.

### Wichtige Dateien

| Pfad                                    | Zweck                                                     |
| --------------------------------------- | --------------------------------------------------------- |
| `src/app/[code]/route.ts`               | Redirect-/Tracking-Route (Kern des Systems)               |
| `src/lib/bridge-html.ts`                | Generierung der Bridge-Page + Fehlerseiten + CSP          |
| `src/lib/bot-detection.ts`              | Bot-/Crawler-/Preview-Erkennung                           |
| `src/lib/event-token.ts`                | Signierte, kurzlebige Event-Tokens (HMAC)                 |
| `src/app/api/beacon/route.ts`           | Clientseitige Event-Bestätigungen                         |
| `src/lib/url-validation.ts`             | Ziel-URL-Validierung (HTTPS-Pflicht, optionale Allowlist) |
| `src/lib/shortcode.ts`                  | Kryptografisch sichere 4-Buchstaben-Codes                 |
| `src/lib/auth.ts`, `src/lib/session.ts` | Benutzer-Auth (DB + Env-Bootstrap), Session, Rate Limiting |
| `src/lib/permissions.ts`                | Rollen (Admin/Marketer/Viewer) und Rechte                 |
| `src/lib/stats.ts`                      | Serverseitig aggregierte Dashboard-Statistiken            |
| `src/lib/geo-stats.ts`, `src/lib/channels.ts` | Geo-/Kanal-Auswertungen für den Analytics-Tab       |
| `src/lib/world-map.ts`                  | Weltkarten-Geometrie (gebündeltes TopoJSON, kein Fetch)   |
| `src/lib/retention.ts`                  | Aggregation + Löschung alter Events                       |
| `src/app/admin/**`                      | Deutschsprachiges Admin-Dashboard                         |
| `src/actions/**`                        | Server Actions (Zod-validiert, auth-geprüft, auditiert)   |
| `prisma/schema.prisma`                  | Datenmodell inkl. Indizes                                 |

### Datenmodell

`Destination` (wiederverwendbare Ziel-URL) ← `ShortLink` (4-Buchstaben-Code,
Source/Medium/Kampagne/Content, Aktiv-Flag, Ablaufdatum) ← `ClickEvent`
(UTC-Zeitstempel, UTM-Parameter, Gerät/Browser/OS, Geo aus Vercel-Headern
inkl. auf ~11 km gerundeter Koordinaten, Bot-Flag + Grund, anonymer
Besucher-Hash, Client-Bestätigungen). Dazu: `User` (Dashboard-Benutzer mit
Rolle, siehe [Benutzer & Rollen](#benutzer--rollen)), `DailyAggregate`
(Langzeit-Statistik), `AuditLog`, `AppSetting`, `LoginAttempt` (Rate
Limiting). Es gibt keine öffentliche Registrierung; der Env-Admin dient nur
noch als Bootstrap-Zugang.

---

## Lokale Installation

Voraussetzungen: **Node.js ≥ 20**, **PostgreSQL** (lokal oder remote), npm.

```bash
git clone https://github.com/soheilxx/urlshorter.git
cd urlshorter
npm install
```

Dann `.env` anlegen (Vorlage: `.env.example`) – siehe
[Environment Variables](#environment-variables) – und Migrationen ausführen:

```bash
npx prisma migrate dev
```

Entwicklungsserver starten:

```bash
npm run dev
```

Dashboard: `http://localhost:3000/admin`

## Datenbankeinrichtung

Beliebiger PostgreSQL-Anbieter (Neon, Supabase, Vercel Postgres, eigener
Server) – die Anbindung erfolgt ausschließlich über `DATABASE_URL`.

- **Serverless (Vercel):** die **gepoolte** Connection-URL des Anbieters
  verwenden (bei Neon z. B. der „Pooled connection string“). Prisma öffnet in
  Serverless-Umgebungen sonst zu viele Verbindungen.
- **Migrationen:** gegen die **direkte** (nicht gepoolte) URL ausführen, falls
  der Anbieter beide anbietet.

Lokal genügt z. B.:

```bash
createdb urlshorter
# DATABASE_URL="postgresql://postgres:passwort@localhost:5432/urlshorter"
```

## Environment Variables

Vollständige, kommentierte Vorlage: [`.env.example`](.env.example). Kurzfassung:

| Variable                                                | Pflicht  | Geheim | Zweck                                            |
| ------------------------------------------------------- | -------- | ------ | ------------------------------------------------ |
| `DATABASE_URL`                                          | ✅       | ✅     | PostgreSQL-Verbindung                            |
| `PUBLIC_BASE_URL`                                       | ✅       | –      | `https://lizenzzumerfolg.com`                    |
| `AUTH_SECRET`                                           | ✅       | ✅     | Session-Signierung (≥ 32 Zeichen)                |
| `APP_SECRET`                                            | ✅       | ✅     | Event-Tokens + Besucher-Hashes (≥ 32 Zeichen)    |
| `ADMIN_EMAIL`                                           | ✅       | ✅     | Admin-Login                                      |
| `ADMIN_PASSWORD_HASH_BASE64`                            | ✅       | ✅     | bcrypt-Hash, Base64-codiert                      |
| `ALLOWED_DESTINATION_HOSTS`                             | –        | –      | `*` = alle HTTPS-Hosts (Standard) oder Allowlist |
| `DEFAULT_REDIRECT_DELAY_MS`                             | –        | –      | 300–2000, Standard 900                           |
| `EVENT_RETENTION_DAYS`                                  | –        | –      | Standard 90                                      |
| `CRON_SECRET`                                           | für Cron | ✅     | Schutz des Cleanup-Endpoints                     |
| `GTM_CONTAINER_ID`                                      | –        | –      | z. B. `GTM-XXXXXXX`                              |
| `GA4_MEASUREMENT_ID`                                    | –        | –      | z. B. `G-XXXXXXXXXX` (nur ohne GTM)              |
| `META_PIXEL_ID`                                         | –        | –      | z. B. `1234567890`                               |
| `REDDIT_PIXEL_ID`                                       | –        | –      | z. B. `a2_abc123def`                             |
| `TRACKING_CONSENT_MODE`                                 | –        | –      | `required` (Standard) oder `not-required`        |
| `CONSENT_COOKIE_NAME` / `CONSENT_COOKIE_ACCEPTED_VALUE` | –        | –      | Consent-Erkennung                                |
| `PRIVACY_URL` / `IMPRINT_URL`                           | –        | –      | Footer-Links der Bridge-Page                     |
| `BRIDGE_EXTRA_CSP_HOSTS`                                | –        | –      | Zusätzliche CSP-Hosts für GTM-Tags               |
| `SENTRY_DSN` / `SENTRY_ENVIRONMENT`                     | –        | ✅/–   | Vorbereitet, optional                            |

Secrets erzeugen:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Admin-Passwort-Hash erzeugen

```bash
npm run hash-password
```

Das Skript fragt das Passwort ab (min. 12 Zeichen) und gibt beide Varianten
aus. **Empfohlen ist `ADMIN_PASSWORD_HASH_BASE64`**: bcrypt-Hashes enthalten
`$`-Zeichen, die von Env-Loadern (u. a. dem von Next.js) als
Variablenreferenz interpretiert und dadurch unbemerkt zerstört werden können.
Die Base64-Variante ist gegen dieses Problem immun.

Es gibt bewusst **keinen** Standard-Login wie `admin/admin`. Fehlen die
Auth-Variablen und existiert noch kein Datenbank-Benutzer, zeigt die
Login-Seite eine Setup-Meldung und der Admin-Bereich bleibt gesperrt.

## Benutzer & Rollen

Das Dashboard hat eine Benutzerverwaltung (`/admin/users`, nur für Admins)
mit E-Mail + Passwort (bcrypt) und drei Rollen:

| Rolle        | Rechte                                                                 |
| ------------ | ---------------------------------------------------------------------- |
| **Admin**    | Vollzugriff: Benutzer, Einstellungen, Links, Ziele, alle Auswertungen  |
| **Marketer** | Kurzlinks & Ziele anlegen/bearbeiten, alle Auswertungen und Exporte    |
| **Viewer**   | Nur Lesezugriff (Übersicht, Analytics, Klicks, Listen, CSV-Export)     |

Funktionsweise und Schutzregeln:

- **Bootstrap:** Der Env-Admin (`ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH_BASE64`)
  bleibt gültig, solange kein Datenbank-Benutzer mit derselben E-Mail
  existiert. Empfohlener Ablauf: mit dem Env-Admin anmelden, unter „Benutzer“
  ein persönliches Admin-Konto anlegen, künftig damit arbeiten.
- Rollen und Aktiv-Status werden bei **jedem Request frisch** aus der
  Datenbank gelesen – Deaktivierung wirkt sofort.
- Passwort-Reset (durch Admins) und eigene Passwort-Änderung
  (`/admin/account`) invalidieren alle bestehenden Sitzungen des Kontos;
  bei der eigenen Änderung wird die aktuelle Sitzung nahtlos erneuert.
- Niemand kann die eigene Rolle ändern, sich selbst deaktivieren oder
  löschen; der letzte aktive Admin ist gegen Herabstufung/Löschung geschützt.
- Alle Benutzer-Aktionen landen im Audit-Log (ohne Passwörter/Hashes).
- Serverseitig erzwingen `requireRole()`/`requireRoleOrThrow()` die Rechte in
  jeder Seite bzw. Server Action (die Navigation blendet nur zusätzlich aus).

## Analytics-Tab (Geo & Kanäle)

`/admin/analytics` (alle Rollen) zeigt die Besucherströme wie eine
Geo-Tracking-Plattform in einem dunklen Panel:

- **Weltkarte** (gebündeltes TopoJSON aus `world-atlas`, kein externer
  Fetch): Länder als Choropleth nach Klickzahl, Städte als pulsierende
  Marker (Größe = Klickvolumen), Tooltips per Hover.
- **Koordinaten** stammen aus den Vercel-Headern `x-vercel-ip-latitude`/
  `-longitude` und werden **auf eine Nachkommastelle (~11 km) gerundet**
  gespeichert (Stadt-Niveau, Datensparsamkeit). Ältere Klicks ohne
  Koordinaten fallen auf Länder-Zentroide zurück.
- **Kanäle** nach dem Vorbild der GA-Channel-Groups (Paid Ads, Organic
  Social, Suche, E-Mail, Referral, Direct, Sonstiges) – klassifiziert aus
  UTM-Parametern, Link-Metadaten und Referrer (`src/lib/channels.ts`).
- Dazu: Live-Feed der letzten Klicks, Top Länder/Städte/Referrer und
  KPI-Kacheln, Zeitraum-Filter wie auf der Übersicht.
- Lokale Demo-Daten für die Karte: `npm run seed:demo` (nur gegen lokale
  Dev-/Test-Datenbanken lauffähig).

## Gewinnspiel (/gewinn)

Unter `https://lizenzzumerfolg.com/gewinn` läuft die Landingpage der
Dubai-Verlosung für Buchkäufer (Route kollidiert nicht mit Kurzlinks – Codes
sind exakt 4 Kleinbuchstaben). Alle Eckwerte werden zentral in
[`src/lib/gewinnspiel-config.ts`](src/lib/gewinnspiel-config.ts) gepflegt
(Fristen, Status, Händler, Gewinnwert, Versionen der Bedingungen, Amazon-Link).

- **Teilnahmen**: Tabelle `SweepstakesEntry` – Bestellnummer als HMAC-Hash
  (Duplikatsperre, global eindeutig) plus AES-256-GCM-verschlüsseltes Original;
  Consent-Zeitpunkte inkl. Versionen; UTM/Referrer serverseitig; Client-Kennung
  nur als nicht rückrechenbarer HMAC. Keine personenbezogenen Daten in Logs
  oder Analytics.
- **Spam-Schutz**: Honeypot (Schein-Erfolg ohne Speicherung), signiertes
  Formular-Token (Mindest-/Höchstalter), Rate Limit pro Client-Kennung.
- **Verwaltung**: `/admin/gewinnspiel` (nur ADMIN) mit Suche/Filtern,
  Detailansicht (entschlüsselte Bestellnummer), Statuspflege, interner Notiz,
  CSV-Export (Injection-geschützt, Semikolon+BOM) und DSGVO-Anonymisierung.
- **E-Mail-Bestätigung**: vorbereitet in `src/lib/mailer.ts`, aber ohne
  konfigurierten Dienst deaktiviert (kein simulierter Versand). Benötigt:
  `MAIL_FROM` + `RESEND_API_KEY` oder `SMTP_URL`.

Die Teilnahmebedingungen (Version in `TERMS_VERSION`) sind unter
`/gewinn/teilnahmebedingungen` veröffentlicht; Veranstalter ist die Wiresoft
Portal Ltd. (DIFC, Dubai). Teilnahme bis zur Gewinnerbekanntgabe möglich,
sofern kein früherer `ENTRY_DEADLINE` gesetzt wird. Eine automatische
Gewinnerziehung ist bewusst nicht implementiert (Ziehung erfolgt manuell,
Status „Gewinner“ wird im Admin gepflegt).

## Zentrales Tracking-Snippet (t.js)

Ein Script-Einbau bringt sämtliche Pixel auf beliebige eigene Websites –
zentral über dieses System gesteuert:

```html
<script async src="https://lizenzzumerfolg.com/t.js?site=SITE_ID" data-site="SITE_ID"></script>
```

- **Sites** werden im Dashboard unter **Websites** verwaltet (nur Admin):
  Domains, Pixel-IDs und Conversion-API-Tokens pro Website – Tokens liegen
  AES-verschlüsselt in der Datenbank ([`src/lib/secrets.ts`](src/lib/secrets.ts))
  und werden in der UI nur maskiert angezeigt. Neue Kunden-Websites brauchen
  kein Deploy mehr. [`src/lib/tag-config.ts`](src/lib/tag-config.ts) enthält
  nur noch den Code-Bootstrap der eigenen Bestands-Sites (Env-Pixel als
  Fallback); Bestands-Snippets ohne `?site=` funktionieren unverändert.
  Das Script deaktiviert sich auf fremden Hostnamen; `/api/tag/collect`
  erzwingt die Allowlist zusätzlich serverseitig (Origin + gemeldete URL) –
  Fremdeinbettung ist damit wirkungslos.
- **Pixel** (GA4/GTM, Meta, TikTok, Reddit, LinkedIn): pro Site im Dashboard;
  leere Felder fallen auf die globalen Env-Werte zurück.
- **Gemessen** werden Seitenaufrufe inkl. SPA-Navigationen (History-API) und
  eigene Events per `window.lze("event", "name")`.
- **First-Party-Erfassung**: Jedes Event landet zusätzlich datensparsam in der
  eigenen Tabelle `TagEvent` (Geo aus Vercel-Headern, Gerät, UTM, rotierender
  Besucher-HMAC + HMAC der First-Party-Cookie-ID `_lze_id`; keine IPs, keine
  Query-Strings). Übersicht: Dashboard → **Websites**.
- **Conversion-APIs**: Ist für eine Site ein Meta-CAPI- bzw.
  TikTok-Events-API-Token hinterlegt (Dashboard, oder global via
  `META_CAPI_ACCESS_TOKEN` / `TIKTOK_EVENTS_API_TOKEN`), wird jedes Event
  serverseitig weitergeleitet – mit derselben `event_id` wie das
  Browser-Pixel, die Anbieter deduplizieren also selbst.

## Amazon Buchrankings

Modul „Amazon Rankings“ im Dashboard: Verkaufsränge des eigenen Buchs
(ASIN 3690662508, „Die Lizenz zum Erfolg“) über **Amazon Creators API**
(primär) und **Rainforest API** (Gegenprüfung, Top-25-Bestsellerlisten,
Credits), kanonische Rangauswahl mit sichtbaren Datenlücken/Stale-Zuständen,
historische Snapshots, Alerts, täglicher Digest, Klick-Verknüpfung und
Exporte. Provider-Aufrufe laufen ausschließlich in Hintergrundjobs
(`/api/cron/amazon`) – niemals im Redirect-Hot-Path.

Dokumentation: [Architektur](docs/amazon-ranking-architecture.md) ·
[Setup](docs/amazon-ranking-setup.md) ·
[Provider](docs/amazon-ranking-providers.md) ·
[Betrieb](docs/amazon-ranking-operations.md) ·
[Datenmodell](docs/amazon-ranking-data-model.md)

## Design-System (TRACK.SITE)

Das Admin-Dashboard folgt seit dem Redesign 2.0 einer eigenen Designsprache
(Vorbild fast.site) unter der Wortmarke **TRACK.SITE**:

- **Tokens** in `src/app/globals.css` (`@theme` + `.dark`-Block):
  `--color-primary` = Königsblau `#1F62FF` (dunkel: `#4D82FF`),
  `--color-surface` = Kartenfläche, `--color-primary-soft` = Aktiv-Pills.
  Charts/Karte beziehen Farben über `--chart-*` und `--map-*`-Variablen.
- **Dark Mode** als Klassenstrategie: Cookie `theme` = `light|dark|system`,
  Inline-Script setzt `.dark` vor dem ersten Paint; die Zinc-Skala wird im
  Dark-Block invertiert, dadurch flippt das gesamte Utility-Markup ohne
  Klassenänderungen. Umschalter: `theme-toggle.tsx` (Sidebar + „Mehr“-Sheet).
- **Schriften:** Inter (Body) und Bricolage Grotesque (Seitentitel,
  Wortmarke) über `next/font`; Utility `font-display`.
- **Responsive Muster:** Desktop behält echte Tabellen (`<tr>/<td>`,
  E2E-Verträge); Mobil erhält additive Karten-Listen (`md:hidden` +
  `hidden md:block`, Desktop-DOM steht im Markup zuerst). Breite Tabellen:
  `TableWrapper stickyFirstColumn` + `Table minWidth` + Scroll-Fade.
  Filterformulare stecken mobil hinter `FilterPanel` (Badge = aktive Filter).
- **Bausteine** in `src/components/admin/`: `page-header.tsx`,
  `segmented-nav.tsx`, `filter-panel.tsx`, `empty-state.tsx`,
  `stat-card.tsx` (mit Delta-Chip + Sparkline-Slot), `brand.tsx`,
  `click-sparkline.tsx`.
- **Navigation:** Desktop-Sidebar (`admin-nav.tsx`), mobil Bottom-Tab-Bar mit
  „Mehr“-Sheet (`mobile-nav.tsx`, rollengefiltert – verbotene Links sind nie
  im DOM). Pillen-Menüs (SegmentedNav, Amazon-Subnav, Sprunganker) brechen
  auf Mobil um bzw. rastern – es gibt bewusst KEINE horizontal scrollenden
  Menüleisten.
- **PWA-Install-Banner:** `pwa-install-banner.tsx` (wegklickbar,
  localStorage-merken; Chrome: `beforeinstallprompt`, iOS: Teilen-Anleitung).
- **Befehls-Palette:** Strg/Cmd-K (`command-palette.tsx`) mit Live-Suche über
  `GET /api/search` (session-geschützt, Kurzlinks + Ziele).
- **QR-Codes:** `qr-card.tsx` auf der Kurzlink-Detailseite (clientseitig via
  `qrcode`, PNG-Download).
- **PWA:** `src/app/manifest.ts` + Icons (`scripts/generate-icons.ts`),
  bewusst ohne Service Worker.
- **Mobile-Tests:** Playwright-Projekt „Mobile Chrome“ (Pixel-7-Viewport,
  `e2e/mobile.spec.ts`): Tab-Bar, „Mehr“-Sheet, FilterPanel, Overflow-Checks,
  Theme-Persistenz. Die übrigen Specs laufen nur im Desktop-Projekt.

## Migrationen

```bash
npx prisma migrate dev      # Entwicklung: Migration erzeugen + anwenden
npx prisma migrate deploy   # Produktion/CI: vorhandene Migrationen anwenden
npx prisma studio           # Daten-GUI
```

## Tests

```bash
npm run lint              # ESLint
npm run typecheck         # TypeScript (strict)
npm test                  # Unit-Tests (Vitest, ohne Datenbank)
npm run test:integration  # Integrationstests (echte Postgres-Testdatenbank)
npm run build             # Produktions-Build
npm run test:e2e          # Playwright-E2E (erwartet vorherigen Build)
```

Integrations- und E2E-Tests verwenden `.env.test` (committet, enthält **nur**
Testwerte) und erwarten eine erreichbare Test-Datenbank `urlshorter_test`
unter der dort hinterlegten `DATABASE_URL`. Vor jedem Lauf werden Migrationen
angewendet und alle Tabellen geleert. E2E-Login: `admin@test.local` /
`E2E-Testpasswort-123!` (nur Testumgebung).

Abgedeckt sind u. a.: Codegenerierung und Kollisionen, URL-/Host-Validierung
(inkl. `amazon.de.example.com`-Angriff), Event-Token-Signatur und -Ablauf,
Session-Tokens inkl. Rollen, Rollen-Rechte, Kanal-Klassifizierung,
Bot-Klassifizierung, Bridge-Page-Inhalte und XSS-Schutz, Consent-Verhalten,
Redirect-Verhalten für deaktivierte/abgelaufene/unbekannte Links, Beacon-
Sicherheit, Retention inkl. Idempotenz, Filter/CSV-Export, der komplette
Browser-Ablauf Login → Ziel → Link → Klick → Bridge → Amazon → Dashboard
sowie Benutzerverwaltung und Rollen-Gating (E2E `e2e/roles.spec.ts`).

## Deployment auf Vercel

1. **Repository verbinden:** Vercel → „Add New… → Project“ → GitHub-Repo
   `urlshorter` importieren. Framework „Next.js“ wird automatisch erkannt.
2. **PostgreSQL erstellen:** z. B. Vercel Postgres/Neon (Marketplace) oder
   extern. Die **gepoolte** Connection-URL kopieren.
3. **`DATABASE_URL` hinterlegen:** Project → Settings → Environment Variables
   (Environment „Production“, optional „Preview“).
4. **Übrige Variablen hinterlegen:** alle Pflichtwerte aus
   [Environment Variables](#environment-variables), insbesondere
   `PUBLIC_BASE_URL=https://lizenzzumerfolg.com`, `AUTH_SECRET`, `APP_SECRET`,
   `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH_BASE64`, `CRON_SECRET`.
5. **Migrationen:** laufen automatisch im Vercel-Build (`vercel.json` →
   `buildCommand: "prisma migrate deploy && next build"`), also VOR dem
   Live-Schalten der neuen Version. Alle Migrationen sind additiv; schlägt
   eine fehl, bricht der Build ab und die alte Version bleibt online.
   Hinweis: Falls der Anbieter eine gepoolte und eine direkte URL anbietet
   und `migrate deploy` an der gepoolten scheitert, die direkte URL als
   `DATABASE_URL` fürs Build-Environment hinterlegen (oder manuell:
   `DATABASE_URL=<direkte-url> npx prisma migrate deploy`).
6. **Admin-Passwort-Hash erzeugen:** lokal `npm run hash-password`, Wert als
   `ADMIN_PASSWORD_HASH_BASE64` eintragen.
7. **Deployment starten:** „Deploy“ bzw. Push auf `main`.
8. **Domain hinzufügen:** Project → Settings → Domains →
   `lizenzzumerfolg.com` eintragen (laut Setup bereits mit Vercel verknüpft –
   dann hier nur den Status prüfen). Optional zusätzlich
   `www.lizenzzumerfolg.com` mit Redirect auf die Apex-Domain.
9. **DNS setzen:** Vercel zeigt nach dem Hinzufügen den **konkreten**
   benötigten DNS-Eintrag an – für eine Apex-Domain wie
   `lizenzzumerfolg.com` üblicherweise einen A-/ALIAS-Eintrag, für `www` einen
   CNAME. **Genau die angezeigten Werte** beim DNS-Anbieter eintragen (keinen
   pauschalen Wert aus Anleitungen übernehmen – Vercel kann projekt-/
   regionsspezifische Ziele anzeigen). Ist die Domain bereits verknüpft und
   zeigt „Valid Configuration“, ist nichts zu tun.
10. **HTTPS prüfen:** Nach DNS-Propagation stellt Vercel automatisch ein
    Zertifikat aus (Domains-Seite → Status „Valid Configuration“).
    `https://lizenzzumerfolg.com/api/health` muss `{"status":"ok"}` liefern.
11. **Testlink anlegen:** `/admin` → Ziele → Amazon-URL anlegen → Kurzlinks →
    „Neuer Kurzlink“. Link im Inkognito-Fenster öffnen: Bridge-Page erscheint
    kurz, danach Amazon. Der Klick erscheint unter „Klicks“.
12. **Tracking prüfen:** siehe [Tracking-Konfiguration](#tracking-konfiguration).
13. **Cron aktivieren:** `vercel.json` enthält bereits den Cron
    (`/api/cron/cleanup`, täglich 03:30 UTC). Vercel richtet ihn beim Deploy
    automatisch ein, sofern `CRON_SECRET` gesetzt ist (Vercel sendet es als
    `Authorization: Bearer …`). Kontrolle: Project → Settings → Cron Jobs.

## Domain und DNS

- Anwendung: `lizenzzumerfolg.com` (Apex-Domain, ausschließlich für dieses
  Tracking-Projekt).
- Der nötige DNS-Eintrag wird von Vercel **pro Projekt angezeigt** (Settings →
  Domains). Diesen Wert exakt übernehmen. Für Apex-Domains verlangt Vercel
  üblicherweise einen A-/ALIAS-Eintrag, für `www` einen CNAME.
- Ein Consent-Cookie muss auf dieser Domain gesetzt werden (z. B.
  `.lizenzzumerfolg.com`), da keine übergeordnete Hauptseite existiert –
  siehe [Consent-Konfiguration](#consent-konfiguration-dsgvo).

## Tracking-Konfiguration

Alle Integrationen sind optional; ohne IDs ist das jeweilige Tracking sauber
deaktiviert. IDs werden serverseitig validiert (Format-Whitelist) – es wird
**kein** frei eingebbares JavaScript ausgeführt (XSS-Schutz).

### Google Tag Manager (`GTM_CONTAINER_ID`)

Vor dem Container-Load wird der `dataLayer` initialisiert und das Event
`amazon_outbound_click` gepusht mit: `event_id`, `short_code`, `link_name`,
`source`, `medium`, `campaign`, `content`, `destination_host`. Im GTM einen
Custom-Event-Trigger auf `amazon_outbound_click` anlegen und die Parameter als
DataLayer-Variablen abgreifen.

**Testen:** GTM Preview-Modus (Tag Assistant) mit einer Kurzlink-URL; im
Browser-DevTools-Network-Tab muss `gtm.js?id=GTM-…` erscheinen (nur bei
Consent).

### Google Analytics 4 (`GA4_MEASUREMENT_ID`)

Nur relevant, wenn **kein** GTM konfiguriert ist – sonst wird GA4 bewusst
nicht zusätzlich geladen (verhindert doppelte Events). Gesendet werden
`page_view` und `amazon_outbound_click` mit denselben Parametern.

**Testen:** GA4 → Verwaltung → DebugView; im Network-Tab Requests an
`google-analytics.com/g/collect` prüfen.

### Meta Pixel (`META_PIXEL_ID`)

Sendet `PageView` und das Custom Event `AmazonOutboundClick`, beide mit
`eventID` = Event-ID des Klicks (Deduplication mit der Conversions API,
siehe unten).

**Testen:** Meta Events Manager → Test-Events, oder Browser-Erweiterung
„Meta Pixel Helper“; im Network-Tab Requests an `facebook.com/tr` prüfen.

### Meta Conversions API (`META_CAPI_ACCESS_TOKEN`)

Serverseitiges Tracking parallel zum Browser-Pixel: Für jeden menschlichen
Klick sendet der Server `PageView` und `AmazonOutboundClick` direkt an die
Graph API – mit **derselben `event_id`** wie das Browser-Pixel. Meta
dedupliziert über (event_name, event_id): Nichts wird doppelt gezählt, aber
Klicks mit Adblocker gehen nicht mehr verloren. Übertragen werden IP-Adresse
und User-Agent (transient, Meta-Pflichtfelder; in der eigenen Datenbank wird
weiterhin keine IP gespeichert) sowie – falls vorhanden – `_fbp`/`_fbc`
bzw. ein aus `fbclid` abgeleiteter Click-Identifier für die Attribution.

**Einrichten:**

1. Meta Events Manager → Datenquellen → Pixel → **Einstellungen** →
   Abschnitt „Conversions API“ → **Zugriffsschlüssel generieren**.
2. Token als `META_CAPI_ACCESS_TOKEN` hinterlegen (geheim!), `META_PIXEL_ID`
   muss ebenfalls gesetzt sein.
3. Zum Prüfen optional den Code aus dem „Test-Events“-Tab als
   `META_CAPI_TEST_EVENT_CODE` setzen – die Server-Events erscheinen dann
   dort in Echtzeit. **Nach dem Test wieder entfernen.**

Der Versand läuft nach der Response (kostet den Besucher keine Zeit), bricht
nach 4 s ab und wird strukturiert geloggt (`meta_capi.sent` /
`meta_capi.send_failed`). Im Events Manager erscheinen Server-Events mit
Quelle „Server“; deduplizierte Paare werden als „Verarbeitet“ mit
Browser+Server angezeigt.

### Reddit Pixel (`REDDIT_PIXEL_ID`)

Sendet `PageVisit` sowie ein Custom Event `OutboundClick` mit
`conversionId` = Event-ID des Klicks (vorbereitet für Deduplication mit der
Reddit Conversions API). Die Pixel-ID beginnt mit `a2_` (Reddit Ads →
Events Manager → Reddit Pixel).

**Testen:** Browser-Erweiterung „Reddit Pixel Helper“ oder im
Network-Tab Requests an `redditstatic.com/ads/pixel.js` und `alb.reddit.com`
prüfen; im Reddit Events Manager erscheinen die Events nach wenigen Minuten.

### TikTok Pixel (`TIKTOK_PIXEL_ID`) + Events API (`TIKTOK_EVENTS_API_TOKEN`)

Das Browser-Pixel sendet `Pageview` sowie das Standard-Event **`ClickButton`**
mit `event_id` = Event-ID des Klicks. Die Events API sendet parallel
serverseitig dasselbe `ClickButton`-Event mit derselben `event_id` an die
TikTok Business API – TikTok dedupliziert über (event, event_id), sodass
nichts doppelt zählt, Adblocker-Klicks aber erfasst bleiben. Für die
Ads-Attribution werden `ttclid` (Query-Parameter aus TikTok-Anzeigen) und das
`_ttp`-Cookie mitgesendet; IP/User-Agent nur transient (keine Speicherung).

**Einrichten:**

1. TikTok Ads Manager → Tools → **Events** → Web Events → dein Pixel.
2. Die Pixel-ID als `TIKTOK_PIXEL_ID` hinterlegen.
3. Für die Events API: Pixel → **Einstellungen** → Abschnitt „Events API“ →
   **„Access Token generieren“** → Token als `TIKTOK_EVENTS_API_TOKEN`
   hinterlegen (geheim!).
4. Optional zum Prüfen: Code aus dem „Test Events“-Tab als
   `TIKTOK_TEST_EVENT_CODE` setzen (danach wieder entfernen).

Logs: `tiktok_events.sent` / `tiktok_events.send_failed`.

### LinkedIn Insight Tag (`LINKEDIN_PARTNER_ID`) + Conversions API

Das Insight Tag (optional, numerische Partner-ID) läuft auf der Bridge-Page
für Audiences/Retargeting. Die **Conversions API** meldet Conversions
serverseitig – LinkedIn verlangt dafür zwingend eine Nutzer-Kennung. Ohne
E-Mails bleibt die LinkedIn-Klick-ID **`li_fat_id`**, die LinkedIn an
Anzeigen-Ziel-URLs anhängt (bzw. das Insight-Tag-Cookie): Server-Events
werden daher **nur für Klicks aus LinkedIn-Anzeigen** gesendet; organische
Klicks kann LinkedIn ohnehin nicht zuordnen. Die `eventId` entspricht der
Klick-Event-ID (Deduplication).

**Einrichten:**

1. **Conversion-Regel:** Campaign Manager → Analysieren →
   Conversion-Tracking → „Conversion erstellen“ → Quelle **„Conversions
   API“** → Regel-ID als `LINKEDIN_CONVERSION_RULE_ID` hinterlegen.
2. **Access Token:** LinkedIn Developer Portal → App mit Produkt
   „Advertising API“ → OAuth-Token mit Scope `rw_conversions` generieren →
   als `LINKEDIN_CAPI_ACCESS_TOKEN` hinterlegen (geheim!).
   **Achtung:** LinkedIn-Tokens laufen nach ~60 Tagen ab.
3. Optional Insight Tag: Partner-ID als `LINKEDIN_PARTNER_ID`.
4. In den Kampagnen sicherstellen, dass LinkedIn `li_fat_id` an die
   Ziel-URLs anhängt (Standard bei aktiviertem Conversion-Tracking).

Logs: `linkedin_capi.sent` / `linkedin_capi.send_failed`.

### Woran erkenne ich, dass ein Link korrekt trackt?

1. Kurzlink im Inkognito-Fenster öffnen → Bridge-Page → Amazon.
2. Dashboard → Klicks: neuer Eintrag mit ✓ bei „Bridge“ und (bei
   konfigurierten Pixeln + Consent) ✓ bei „Tracking“ sowie „Redirect“.
3. Übersicht: „Bridge-Page geladen“ und „Tracking angestoßen“ nahe 100 %
   (Adblocker drücken die Tracking-Quote – das ist normal).

### Spätere Erweiterungen (vorbereitet)

Die Architektur (stabile `event_id` pro Klick, `AmazonOutboundClick` mit
`eventID`) ist für **Meta Conversions API**, **GA4 Measurement Protocol** und
**Amazon Attribution** vorbereitet: serverseitige Sender können als eigene
Module an den Click-Event angeschlossen werden, ohne den Redirect-Fluss zu
ändern. Für Amazon Attribution einfach die Attribution-URL als Destination
hinterlegen.

## Consent-Konfiguration (DSGVO)

Das System unterscheidet strikt:

1. **Notwendige serverseitige Erfassung** des Kurzlink-Aufrufs (ohne Cookies,
   ohne IP-Speicherung, anonymer täglich rotierender Hash) – läuft immer.
2. **Marketing-Tracking** (GTM/GA4/Meta) – standardmäßig nur mit erkannter
   Einwilligung.

Modi (`TRACKING_CONSENT_MODE`):

- **`required` (Standard):** Pixel feuern nur, wenn der Cookie
  `CONSENT_COOKIE_NAME` exakt den Wert `CONSENT_COOKIE_ACCEPTED_VALUE` trägt.
  Ohne Consent: kein GTM/GA4/Meta-Load, keine Marketing-Cookies, Google
  Consent Mode v2 auf `denied` – und trotzdem unverzögerte Weiterleitung zu
  Amazon.
- **`not-required`:** Pixel feuern immer. Nur verwenden, wenn eine eigene
  rechtliche Bewertung dies deckt.

Da `lizenzzumerfolg.com` ausschließlich als Tracking-/Redirect-Domain dient,
gibt es dort keinen klassischen Cookie-Banner-Flow: Besucher sind nur wenige
Hundert Millisekunden auf der Seite. Im Modus `required` ohne gesetzten
Consent-Cookie werden daher praktisch nie Marketing-Pixel gefeuert (nur die
eigene serverseitige Zählung läuft). Wer Pixel einsetzen will, muss entweder
eine Consent-Lösung vorschalten, die den Cookie auf dieser Domain setzt, oder
nach eigener rechtlicher Bewertung `not-required` verwenden.

> **Wichtig:** Die konkrete rechtliche Bewertung, die Datenschutzerklärung und
> die Consent-Konfiguration müssen **vor dem Produktiveinsatz** durch den
> Betreiber bzw. eine Rechtsberatung geprüft werden. Dieses Projekt liefert
> die technische Grundlage, ersetzt aber keine Rechtsberatung. Es sind
> bewusst keine manipulativen Consent-Mechanismen enthalten.

## Datenschutz-Hinweise

- **Keine IP-Speicherung:** Die IP fließt ausschließlich in einen
  HMAC-Hash (`APP_SECRET` + täglich rotierender Schlüssel) für die
  Unique-Visitor-Zählung ein und ist nicht rekonstruierbar.
- **Datensparsamkeit:** Nur die fünf definierten UTM-Parameter werden
  gespeichert; alle anderen Query-Parameter werden verworfen.
- **Ehrliche Kennzeichnung:** Pixel-Status wird nur als „angestoßen“ bzw.
  „Client-Event empfangen“ geführt – ob ein Drittanbieter das Event wirklich
  verarbeitet hat (Adblocker, Netzwerkfehler), kann das System nicht wissen.
- **Beacon-Sicherheit:** Client-Status-Updates erfordern ein signiertes,
  kurzlebiges Event-Token (HMAC-SHA256, 15 min TTL). Die Kenntnis einer
  Event-ID allein genügt nicht.
- **Logs:** Strukturierte JSON-Logs ohne Secrets, Passwörter oder IPs.

## Bot-Erkennung

Heuristik in `src/lib/bot-detection.ts`:

- `HEAD`-Anfragen und Prefetch/Preview-Header (`purpose`, `sec-purpose`),
- fehlender User-Agent,
- UA-Muster: Suchmaschinen (Google/Bing/…), Social-Previews (WhatsApp,
  Telegram, Facebook, Slack, Discord, …), SEO-Tools, Uptime-Monitore,
  HTTP-Bibliotheken (curl, python-requests, …), Headless-Browser,
  KI-Crawler, generische `bot|crawler|spider`-Muster.

Bot-Aufrufe werden **gespeichert** (mit Klassifizierungsgrund), aber in allen
Standardstatistiken ausgeschlossen. Im Dashboard gibt es eine separate
Bot-Ansicht (Übersicht: „Bot-Auswertung“, Klicktabelle: Bot-Filter). Bots
erhalten einen direkten 302-Redirect statt der Bridge-Page – Link-Previews
zeigen so die Amazon-Seite an.

## Datenaufbewahrung

- `EVENT_RETENTION_DAYS` (Standard 90): Detaillierte Click-Events, die älter
  sind, werden beim täglichen Cron zunächst **tagesweise aggregiert**
  (`DailyAggregate`: menschliche Klicks, Bots, Unique Visitors pro Link und
  Berliner Kalendertag) und dann gelöscht. Langzeit-Diagramme („Klicks pro
  Tag“) beziehen die Aggregate automatisch ein.
- Loginversuche werden nach 7 Tagen gelöscht.
- Cron: `vercel.json` → `GET /api/cron/cleanup`, geschützt durch
  `Authorization: Bearer CRON_SECRET`. Manueller Aufruf:
  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" https://lizenzzumerfolg.com/api/cron/cleanup
  ```

## Backup-Hinweise

- Die Datenbank ist der einzige persistente Zustand. Automatische Backups des
  DB-Anbieters aktivieren (Neon/Supabase/Vercel Postgres bieten
  Point-in-Time-Recovery bzw. tägliche Snapshots).
- Zusätzlich empfohlen: regelmäßiger `pg_dump` (z. B. wöchentlich) an einen
  zweiten Ort.
- Secrets (`AUTH_SECRET`, `APP_SECRET`, `ADMIN_PASSWORD_HASH_BASE64`,
  `CRON_SECRET`) sicher ablegen (Passwortmanager) – bei Rotation von
  `AUTH_SECRET` werden alle Sessions ungültig (gewollt), bei Rotation von
  `APP_SECRET` brechen nur offene Event-Tokens (15 min) und die
  Unique-Zählung des laufenden Tages.

## Fehlerbehebung

| Symptom                                                  | Ursache / Lösung                                                                                                                                                                                                                                     |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login-Seite meldet „Setup unvollständig“                 | Auth-Variablen fehlen → `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH_BASE64`, `AUTH_SECRET` setzen und neu deployen.                                                                                                                                          |
| Login schlägt trotz korrektem Passwort fehl              | Klassiker: `$`-Zeichen im bcrypt-Hash wurden vom Env-Loader expandiert → `ADMIN_PASSWORD_HASH_BASE64` verwenden (`npm run hash-password`).                                                                                                           |
| „Zu viele fehlgeschlagene Loginversuche“                 | Rate Limit (5 Fehlversuche/15 min) → warten oder alte `LoginAttempt`-Einträge löschen.                                                                                                                                                               |
| Kurzlink zeigt Fehlerseite                               | Link oder Ziel deaktiviert bzw. abgelaufen → Dashboard → Kurzlinks/Ziele prüfen.                                                                                                                                                                     |
| Pixel feuern nicht                                       | Consent-Modus `required` ohne gültigen Consent-Cookie (gewollt), Adblocker, oder ID-Format ungültig (Dashboard → Einstellungen → Systemstatus).                                                                                                      |
| GTM-Tags eines Drittanbieters laden nicht                | CSP der Bridge-Page → Host in `BRIDGE_EXTRA_CSP_HOSTS` ergänzen.                                                                                                                                                                                     |
| `/api/health` liefert `degraded`                         | Datenbank nicht erreichbar → `DATABASE_URL`/DB-Status prüfen.                                                                                                                                                                                        |
| Zu viele DB-Verbindungen (Serverless)                    | Gepoolte Connection-URL verwenden.                                                                                                                                                                                                                   |
| Cron läuft nicht                                         | `CRON_SECRET` fehlt oder Cron nicht aktiv (Vercel → Settings → Cron Jobs).                                                                                                                                                                           |
| Formular-Submit bleibt auf „Wird gespeichert …“ hängen   | Next-15-Race: Bei `useActionState` **mit** `revalidatePath` (oder key-Remount des `<form>`) verwirft der Client-Router sporadisch die Action-Antwort – der Server hat aber geschrieben (Beleg: POST 200 + `x-action-revalidated`, kein Console-Fehler). Die Benutzer-Formulare nutzen deshalb `router.refresh()` nach Erfolg statt `revalidatePath` (siehe `user-forms.tsx`/`user-actions.ts`). Die älteren Link-/Ziel-Formulare können lokal unter Last selten noch hängen → Seite neu laden, Eintrag ist angelegt; die E2E-Tests prüfen deshalb das Ergebnis (Listeneintrag) statt nur der Erfolgsmeldung. |

Systemstatus: Dashboard → Einstellungen (DB-Status, konfigurierte
Integrationen, Consent-Modus, Retention, Audit-Log). Health-Endpoint:
`GET /api/health` (ohne sensible Informationen).

**Sentry (optional):** `SENTRY_DSN` ist vorbereitet. Zur Aktivierung
`@sentry/nextjs` installieren (`npx @sentry/wizard@latest -i nextjs`); die
Anwendung funktioniert ohne Sentry vollständig.

## Grenzen der Messbarkeit

**Das System misst Klicks, keine Käufe.** Es kann zuverlässig erfassen, dass
ein Besucher einen Kurzlink aufgerufen hat und die Weiterleitung zur
Amazon-Seite gestartet wurde. Ob der Besucher das Buch anschließend
**tatsächlich gekauft** hat, kann ohne zusätzliche Amazon-Daten (z. B. eine
Amazon-Attribution-Anbindung) **nicht** festgestellt werden. Im Dashboard
werden Klicks deshalb bewusst nie als „Bestellungen“ oder „Verkäufe“
bezeichnet.

Weitere Grenzen:

- Adblocker verhindern Pixel-Loads und teils auch Beacons → „Tracking
  angestoßen“ ist eine Untergrenze.
- Die Bot-Erkennung ist heuristisch; sehr gut getarnte Bots werden als
  Menschen gezählt, exotische Clients evtl. fälschlich als Bot.
- Unique Visitors basieren auf einem täglich rotierenden Hash → über mehrere
  Tage hinweg werden Wiederkehrer als neue Besucher gezählt (Datenschutz vor
  Präzision).
- 26⁴ = 456.976 mögliche Codes – mehr als ausreichend für diesen Einsatzzweck,
  aber kein unbegrenzter Namensraum.
