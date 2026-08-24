# urlshorter – Amazon-Kurzlink-Tracking für `lizenzzumerfolg.com`

Redirect- und Tracking-System für den Buchverkauf über Amazon. Da auf der
Amazon-Produktseite keine eigenen Pixel installiert werden können, misst dieses
System den Klick **vor** der Weiterleitung: Ein Besucher ruft z. B.
`https://lizenzzumerfolg.com/abcd` auf, der Klick wird serverseitig erfasst,
eine minimale Weiterleitungsseite („Bridge-Page“) stößt die konfigurierten
Tracking-Pixel an und leitet danach automatisch zur hinterlegten
Amazon-Bestellseite weiter. Die Domain `lizenzzumerfolg.com` wird
ausschließlich für dieses Tracking-Projekt genutzt.

---

## Inhalt

1. [Architektur](#architektur)
2. [Lokale Installation](#lokale-installation)
3. [Datenbankeinrichtung](#datenbankeinrichtung)
4. [Environment Variables](#environment-variables)
5. [Admin-Passwort-Hash erzeugen](#admin-passwort-hash-erzeugen)
6. [Migrationen](#migrationen)
7. [Tests](#tests)
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
6. **Bots:** direkter 302-Redirect zur Amazon-URL (keine Pixel nötig).
   **Menschen:** minimale Bridge-Page (Status 200, wenige KB Inline-HTML/CSS/JS,
   kein React, keine Bilder/Fonts):
   - `dataLayer`-Initialisierung + Google Consent Mode v2,
   - je nach Consent: GTM / GA4 / Meta Pixel mit Event `amazon_outbound_click`,
   - Beacons an `/api/beacon` (signiertes Event-Token): Bridge geladen,
     Tracking angestoßen, Redirect gestartet, manueller Klick,
   - nach konfigurierbarer Verzögerung (300–2000 ms, Standard 900 ms):
     `window.location.replace(amazonUrl)`,
   - sichtbarer Fallback-Button „Jetzt zu Amazon“, `<noscript>`-Meta-Refresh,
   - Links zu Datenschutz und Impressum.
7. Die Route sendet strikte `Cache-Control: no-store`-Header (inkl.
   `Vercel-CDN-Cache-Control`) – jeder Aufruf wird serverseitig verarbeitet.

**Fehlerphilosophie:** Sobald der Kurzlink geladen ist, hat die Erreichbarkeit
von Amazon Priorität. Scheitert irgendetwas danach (Datenbank, Einstellungen,
Token), wird der Fehler strukturiert geloggt und der Besucher direkt per 302
weitergeleitet – ein Trackingfehler kostet nie einen Kauf.

### Wichtige Dateien

| Pfad                                    | Zweck                                                   |
| --------------------------------------- | ------------------------------------------------------- |
| `src/app/[code]/route.ts`               | Redirect-/Tracking-Route (Kern des Systems)             |
| `src/lib/bridge-html.ts`                | Generierung der Bridge-Page + Fehlerseiten + CSP        |
| `src/lib/bot-detection.ts`              | Bot-/Crawler-/Preview-Erkennung                         |
| `src/lib/event-token.ts`                | Signierte, kurzlebige Event-Tokens (HMAC)               |
| `src/app/api/beacon/route.ts`           | Clientseitige Event-Bestätigungen                       |
| `src/lib/url-validation.ts`             | Host-Allowlist (Open-Redirect-Schutz)                   |
| `src/lib/shortcode.ts`                  | Kryptografisch sichere 4-Buchstaben-Codes               |
| `src/lib/auth.ts`, `src/lib/session.ts` | Single-Admin-Auth, Session, Rate Limiting               |
| `src/lib/stats.ts`                      | Serverseitig aggregierte Dashboard-Statistiken          |
| `src/lib/retention.ts`                  | Aggregation + Löschung alter Events                     |
| `src/app/admin/**`                      | Deutschsprachiges Admin-Dashboard                       |
| `src/actions/**`                        | Server Actions (Zod-validiert, auth-geprüft, auditiert) |
| `prisma/schema.prisma`                  | Datenmodell inkl. Indizes                               |

### Datenmodell

`Destination` (wiederverwendbares Amazon-Ziel) ← `ShortLink` (4-Buchstaben-Code,
Source/Medium/Kampagne/Content, Aktiv-Flag, Ablaufdatum) ← `ClickEvent`
(UTC-Zeitstempel, UTM-Parameter, Gerät/Browser/OS, Geo aus Vercel-Headern,
Bot-Flag + Grund, anonymer Besucher-Hash, Client-Bestätigungen). Dazu:
`DailyAggregate` (Langzeit-Statistik), `AuditLog`, `AppSetting`,
`LoginAttempt` (Rate Limiting). Der Admin wird über Environment Variables
konfiguriert (Single-Admin-Lösung, keine öffentliche Registrierung).

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

| Variable                                                | Pflicht  | Geheim | Zweck                                         |
| ------------------------------------------------------- | -------- | ------ | --------------------------------------------- |
| `DATABASE_URL`                                          | ✅       | ✅     | PostgreSQL-Verbindung                         |
| `PUBLIC_BASE_URL`                                       | ✅       | –      | `https://lizenzzumerfolg.com`                 |
| `AUTH_SECRET`                                           | ✅       | ✅     | Session-Signierung (≥ 32 Zeichen)             |
| `APP_SECRET`                                            | ✅       | ✅     | Event-Tokens + Besucher-Hashes (≥ 32 Zeichen) |
| `ADMIN_EMAIL`                                           | ✅       | ✅     | Admin-Login                                   |
| `ADMIN_PASSWORD_HASH_BASE64`                            | ✅       | ✅     | bcrypt-Hash, Base64-codiert                   |
| `ALLOWED_DESTINATION_HOSTS`                             | –        | –      | Standard: `amazon.de,www.amazon.de,amzn.eu`   |
| `DEFAULT_REDIRECT_DELAY_MS`                             | –        | –      | 300–2000, Standard 900                        |
| `EVENT_RETENTION_DAYS`                                  | –        | –      | Standard 90                                   |
| `CRON_SECRET`                                           | für Cron | ✅     | Schutz des Cleanup-Endpoints                  |
| `GTM_CONTAINER_ID`                                      | –        | –      | z. B. `GTM-XXXXXXX`                           |
| `GA4_MEASUREMENT_ID`                                    | –        | –      | z. B. `G-XXXXXXXXXX` (nur ohne GTM)           |
| `META_PIXEL_ID`                                         | –        | –      | z. B. `1234567890`                            |
| `TRACKING_CONSENT_MODE`                                 | –        | –      | `required` (Standard) oder `not-required`     |
| `CONSENT_COOKIE_NAME` / `CONSENT_COOKIE_ACCEPTED_VALUE` | –        | –      | Consent-Erkennung                             |
| `PRIVACY_URL` / `IMPRINT_URL`                           | –        | –      | Footer-Links der Bridge-Page                  |
| `BRIDGE_EXTRA_CSP_HOSTS`                                | –        | –      | Zusätzliche CSP-Hosts für GTM-Tags            |
| `SENTRY_DSN` / `SENTRY_ENVIRONMENT`                     | –        | ✅/–   | Vorbereitet, optional                         |

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
Auth-Variablen, zeigt die Login-Seite eine Setup-Meldung und der Admin-Bereich
bleibt gesperrt.

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
Bot-Klassifizierung, Bridge-Page-Inhalte und XSS-Schutz, Consent-Verhalten,
Redirect-Verhalten für deaktivierte/abgelaufene/unbekannte Links, Beacon-
Sicherheit, Retention inkl. Idempotenz, Filter/CSV-Export sowie der komplette
Browser-Ablauf Login → Ziel → Link → Klick → Bridge → Amazon → Dashboard.

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
5. **Migrationen ausführen:** lokal gegen die Produktions-DB (direkte URL):
   ```bash
   $env:DATABASE_URL="<direkte-produktions-url>"   # PowerShell
   npx prisma migrate deploy
   ```
   Alternativ: Build-Command in Vercel auf
   `prisma migrate deploy && next build` setzen.
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
`eventID` = Event-ID des Klicks – vorbereitet für spätere Deduplication mit
der Conversions API.

**Testen:** Meta Events Manager → Test-Events, oder Browser-Erweiterung
„Meta Pixel Helper“; im Network-Tab Requests an `facebook.com/tr` prüfen.

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

| Symptom                                     | Ursache / Lösung                                                                                                                                |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Login-Seite meldet „Setup unvollständig“    | Auth-Variablen fehlen → `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH_BASE64`, `AUTH_SECRET` setzen und neu deployen.                                     |
| Login schlägt trotz korrektem Passwort fehl | Klassiker: `$`-Zeichen im bcrypt-Hash wurden vom Env-Loader expandiert → `ADMIN_PASSWORD_HASH_BASE64` verwenden (`npm run hash-password`).      |
| „Zu viele fehlgeschlagene Loginversuche“    | Rate Limit (5 Fehlversuche/15 min) → warten oder alte `LoginAttempt`-Einträge löschen.                                                          |
| Kurzlink zeigt Fehlerseite                  | Link oder Ziel deaktiviert bzw. abgelaufen → Dashboard → Kurzlinks/Ziele prüfen.                                                                |
| Pixel feuern nicht                          | Consent-Modus `required` ohne gültigen Consent-Cookie (gewollt), Adblocker, oder ID-Format ungültig (Dashboard → Einstellungen → Systemstatus). |
| GTM-Tags eines Drittanbieters laden nicht   | CSP der Bridge-Page → Host in `BRIDGE_EXTRA_CSP_HOSTS` ergänzen.                                                                                |
| `/api/health` liefert `degraded`            | Datenbank nicht erreichbar → `DATABASE_URL`/DB-Status prüfen.                                                                                   |
| Zu viele DB-Verbindungen (Serverless)       | Gepoolte Connection-URL verwenden.                                                                                                              |
| Cron läuft nicht                            | `CRON_SECRET` fehlt oder Cron nicht aktiv (Vercel → Settings → Cron Jobs).                                                                      |

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
