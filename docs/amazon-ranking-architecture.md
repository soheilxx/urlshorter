# Amazon Buchrankings – Architektur

Modul „Amazon Rankings" für das bestehende Tracking- und Kurzlink-System
(lizenzzumerfolg.com). Stand: 2026-08-29.

## Erkannter Stack

| Bereich          | Technologie                                                        |
| ---------------- | ------------------------------------------------------------------ |
| Framework        | Next.js 15 (App Router), React 19, TypeScript strict               |
| Datenbank        | PostgreSQL über Prisma 6 (`prisma migrate`, additive Migrationen)  |
| Deployment       | Vercel (`vercel.json`: `prisma migrate deploy && next build`)      |
| Scheduler        | Vercel Cron (`/api/cron/cleanup`, Bearer `CRON_SECRET`)            |
| Auth             | Eigene Session-Cookies, Rollen ADMIN/MARKETER/VIEWER               |
| Admin-UI         | Tailwind 4, eigene UI-Komponenten (Card/Table/Badge/Alert/Input),  |
|                  | lucide-react-Icons, helles Zinc-Design, `AdminNav`                 |
| Charts           | Recharts 2 (`src/components/admin/charts.tsx`)                     |
| Mutationen       | Server Actions + `useActionState` + `useSuccessRefresh` (kein      |
|                  | `revalidatePath` in zustandsbehafteten Actions – Router-Race)      |
| Settings         | `AppSetting`-Key-Value-Tabelle (`src/lib/settings.ts`)             |
| Audit            | `writeAuditLog` (`src/lib/audit.ts`), niemals Secrets              |
| Logging          | Strukturierte JSON-Logs (`src/lib/logger.ts`)                      |
| Mail             | `src/lib/mailer.ts` (Interface vorhanden, Provider unkonfiguriert) |
| Tests            | Vitest (Unit + Integration gegen echte Test-DB), Playwright E2E    |
| Zeit             | Speicherung UTC (`Timestamptz`), Anzeige Europe/Berlin             |

Redirect-Hot-Path: `src/app/[code]/route.ts` (4-Buchstaben-Codes) – wird von
diesem Modul **nicht berührt**. Alle Provider-Aufrufe laufen ausschließlich in
Hintergrundjobs bzw. manuell ausgelösten Admin-Aktionen.

## Integrationspunkte

- Navigation: neuer Eintrag „Amazon Rankings" in `AdminNav` (sichtbar für alle
  Rollen; schreibende Aktionen nur ADMIN).
- Seiten: `/admin/amazon` (Übersicht), `/buch`, `/top25`, `/kategorien`,
  `/provider`, `/einstellungen`.
- Scheduler: neuer Endpoint `/api/cron/amazon` (Bearer `CRON_SECRET`), ein
  „Tick" führt alle fälligen Jobs aus. Vercel-Cron ruft den Tick auf; auf dem
  Hobby-Plan ist nur 1×/Tag garantiert – für stündliches Tracking wird der
  Endpoint zusätzlich extern angestoßen (GitHub-Actions-Workflow liegt bei,
  siehe `docs/amazon-ranking-operations.md`).
- Klickdaten: Verknüpfung über `ShortLink`/`ClickEvent` (Destination-Host
  amazon.* bzw. konfigurierter Kurzlink der Edition, z. B. `/wulp`).
- Einstellungen: `AppSetting`-Keys `amazon.*` (im Dashboard ohne Deployment
  änderbar), Env-Variablen nur als Standardwerte.
- Export: `/api/export/amazon` (CSV/JSON, Session-geschützt).

## Providerstrategie

Zwei Provider hinter einer Capability-basierten Abstraktion
(`src/lib/amazon/provider-types.ts`):

1. **Amazon Creators API** (Nachfolger der PA-API 5):
   - OAuth 2.0 Client Credentials (`AMAZON_CREATORS_CREDENTIAL_ID/SECRET`),
     Token-Endpoint `https://api.amazon.com/auth/o2/token` (per Env
     überschreibbar, Credential-Version bestimmt Region), Scope
     `creatorsapi::default`, Token 3600 s, serverseitiger Cache mit
     Single-Flight-Erneuerung.
   - `POST https://creatorsapi.amazon/catalog/v1/getItems` mit Headern
     `Authorization: Bearer`, `x-marketplace: www.amazon.de`; lowerCamelCase,
     max. 10 ASINs pro Batch; Zuordnung über `asin`, nie über Array-Position.
   - Zuständig (primär): eigener Gesamtrang (`websiteSalesRank`),
     Kategorienränge (`browseNodeInfo.browseNodes[].salesRank`), Cover,
     Basis-Metadaten.
2. **Rainforest API** (`api.rainforestapi.com`):
   - `type=product` (Gegenprüfung Ränge via `bestsellers_rank`, primär für
     Preis/Bewertung/Verfügbarkeit), `type=bestsellers` (einzige Quelle der
     Top-25-Reihenfolge), Categories API (`type=bestsellers`-Kategorien inkl.
     Sachbücher-Auflösung), Account API (Credits, kostenlos).
   - API-Key nur serverseitig; jede geloggte/gespeicherte URL wird um
     `api_key` bereinigt (`redactSecrets`).

Kanonische Auswahl (eigenes Buch): Creators (frisch & vollständig) →
Rainforest → letzter kanonischer Wert als `stale` → Datenlücke (`dataGap`).
Beide Beobachtungen werden immer getrennt gespeichert; Abweichung wird als
`providerDifference` berechnet und als Datenqualitätsindikator angezeigt –
nie als „Fehler" eines Providers.

Top-25: Reihenfolge ausschließlich aus dem Rainforest-Bestseller-Snapshot;
Creators-Metadaten reichern nur an (Cache), ändern nie die Rangfolge.
SearchItems wird bewusst nicht als Bestsellerliste verwendet.

## Datenfluss

```
Vercel Cron / externer Pinger / Admin-Button
        │
        ▼
/api/cron/amazon  ──► Job-Registry (AmazonJobState: fällig? Lock!)
        │
        ├─ refresh-primary-book-ranks ──► Creators + Rainforest (allSettled)
        │       └─► AmazonRankObservation (beide Provider, getrennt)
        │       └─► AmazonCanonicalRankSnapshot (Auswahl + stale/dataGap)
        │       └─► Alert-Evaluierung
        ├─ refresh-category-leaderboards ──► Rainforest bestsellers
        │       └─► AmazonLeaderboardSnapshot + 25 Entries (Reihenfolge roh)
        ├─ refresh-product-metadata ──► Creators (Fallback Rainforest)
        ├─ resolve-amazon-categories ──► Rainforest Categories / Creators Nodes
        ├─ refresh-provider-health / refresh-rainforest-account-status
        ├─ send-daily-ranking-digest (1×/Kalendertag Europe/Berlin, ab 08:00)
        └─ cleanup-provider-payloads (redigierte Rohpayloads > 30 Tage)
```

Externe Antwort wird erst vollständig geladen, validiert (zod) und normalisiert;
erst danach kurze DB-Transaktion. Keine externen Requests innerhalb von
DB-Transaktionen, keine Provider-Aufrufe im Redirect-Pfad.

## Datenmodell (Prisma, Präfix `Amazon…`)

- `AmazonBook` / `AmazonEdition` (Buch ↔ ASIN-spezifische Ausgabe; Ränge nie
  editionsübergreifend vermischt; `preorder`-Status pro Edition).
- `AmazonCategory` (+ Typ `WEBSITE` für den Gesamtbuchrang als uniforme
  Zeitreihe), `AmazonCategoryProviderMapping` (Browse-Node ↔ Rainforest-ID,
  `verified`-Flag), `AmazonEditionCategory` (Auto-Discovery, Ein-/Austritt).
- `AmazonRankObservation` (pro Provider; `rank` positiv oder NULL – nie 0;
  `sourceStatus` live/partial/cached/manual; Upsert über
  `[editionId, categoryId, provider, observedAt]`).
- `AmazonCanonicalRankSnapshot` (Auswahl, Begründung, stale/dataGap,
  Referenzen auf beide Beobachtungen).
- `AmazonLeaderboardSnapshot` + `AmazonLeaderboardEntry` (Top 25 mit allen
  Anzeige-Snapshots; `position` = Ergebnisposition, `bestsellerRank` = Rang).
- `AmazonProductMetadataSnapshot`, `AmazonProviderRun` (Laufhistorie inkl.
  Credits/Latenz/Fehlerklasse ohne Secrets), `AmazonProviderStatus`
  (Health/Circuit-Breaker/Quota), `AmazonJobState` (Scheduler-Zustand, Locks,
  Intervalle), `AmazonRawPayload` (redigiert, 30 Tage).
- `AmazonAlertRule` / `AmazonAlertEvent` (Cooldown + Dedupe + Historie),
  `AmazonAnnotation`, `AmazonDigestRun` (Unique je Kalendertag/Zeitzone/
  Empfänger), `AmazonSalesEstimate` (immer `estimated`), 
  `AmazonActualSalesImport` (strikt getrennt von Schätzungen).

Alle Migrationen sind additiv; bestehende Tabellen werden nicht verändert.

## Schedulerstrategie

- Ein Tick-Endpoint, DB-basierte Job-Registry (`AmazonJobState`): pro Job
  `nextRunAt`, Intervall (Settings-Override → Env-Default), Lock über
  bedingtes `UPDATE … WHERE lockedUntil < now()` (verteilter Lock, schützt
  vor Doppelstarts über mehrere Serverless-Instanzen).
- Jobs: Timeout, Retry mit exponentiellem Backoff + Jitter (nur transiente
  Fehler), Circuit Breaker pro Provider (`AmazonProviderStatus`), Correlation
  ID, `AmazonProviderRun`-Historie, partial-success (ein Providerfehler
  verwirft nie das Ergebnis des anderen – `Promise.allSettled`).
- Intervalle: Presets 15/30/60 min, 3/6/12/24 h + benutzerdefiniert; vor dem
  Speichern Prüfung gegen Mindestintervall, Creditbudget und Monatsprognose.
- Manuelle Auslösung pro Job im Adminbereich (ADMIN, Rate-Limit,
  Credit-Warnung, derselbe Lock).

## Fallbacks

| Fall                                | Verhalten                                              |
| ----------------------------------- | ------------------------------------------------------ |
| Creators liefert keinen Rang        | Rainforest-Wert wird kanonisch (`selectionReason`)     |
| Beide Provider fehlgeschlagen       | letzter kanonischer Wert als `stale`, sonst `dataGap`  |
| Rainforest-Kategorie-ID defekt      | Bestseller-Abruf über gespeicherte URL (`url=`)        |
| Leaderboard nicht abrufbar          | letzter vollständiger Snapshot, deutlich `stale`       |
| Circuit Breaker offen               | Provider wird übersprungen, Status sichtbar            |
| Credits erschöpft                   | Rainforest-Jobs pausieren, Alert, UI-Hinweis           |

Fehlgeschlagene Messungen werden nie als unveränderte Messung gespeichert;
Lücken bleiben in Zeitreihen und Charts sichtbar (keine Interpolation).

## Quota-Strategie

- Rainforest Account API (kostenlos) alle 6 h → `AmazonProviderStatus.quota`.
- Warnstufen < 30 % / < 20 % / < 10 % Credits + Prognosewarnung, wenn der aus
  den aktuellen Intervallen berechnete Monatsverbrauch das Restbudget
  überschreitet (`src/lib/amazon/quota.ts`, rein und unit-getestet).
- Optionales Tagesbudget (`amazon.dailyCreditBudget`): Jobs, die das Budget
  überschreiten würden, werden übersprungen (Run-Status `SKIPPED`).
- Creators-Metadaten werden gecacht (24 h) – Top-25-Anreicherung nur für
  Cache-Misses, keine 25 Produktrequests pro Leaderboard-Lauf.

## Sicherheitskonzept

- Secrets (`RAINFOREST_API_KEY`, `AMAZON_CREATORS_CREDENTIAL_*`) nur
  serverseitig aus Env; nie in DB, Logs, Fehlern, URLs, Client-Bundles.
- `redactSecrets()` entfernt `api_key`-Query-Parameter und Bearer-Token aus
  allen Fehlermeldungen/gespeicherten URLs; Account-Payload wird vor
  Speicherung um `api_key`/`email` bereinigt.
- SSRF-Allowlist: `api.amazon.com` (+ regionale Token-Endpoints),
  `creatorsapi.amazon`, `api.rainforestapi.com`, Amazon-Bildhosts
  (`m.media-amazon.com`, `images-eu.ssl-images-amazon.com`, `images-na…`).
  Es werden ausschließlich diese Hosts kontaktiert.
- Schreibende Aktionen: ADMIN + Validierung (zod, ISBN-Prüfziffer,
  ASIN-Format `^[A-Z0-9]{10}$`, Kategorie-IDs, Intervallgrenzen) + Audit-Log
  + Rate-Limit für manuelle Refreshes.
- Response-Größenlimit und Timeout für alle Provider-Requests; kein HTML
  (`include_html=false`), keine Roh-HTML-Speicherung, kein Scraping, keine
  Anti-Bot-Techniken.
- Affiliate-Links verwenden den Partner-Tag; UI zeigt den nötigen
  Amazon-Partnerhinweis; Preise immer mit Beobachtungszeitpunkt.

## UI-Struktur

Bestehendes Designsystem (Cards, Tables, Badges, StatCards, Recharts,
Zinc-Palette). Rangfarben: Verbesserung grün (`emerald`), Verschlechterung
rot, neutral zinc, Lücken/stale amber – immer mit Pfeil-Icon + Klartext +
`sr-only`-Text (nie Farbe als einziges Signal).

- Übersicht: Buchkarte (Cover, Preis, Vorbestellstatus, Bewertung), KPI-Kacheln
  (24h/7d/30d, Bestwert), Hauptchart (Y invertiert, Rang 1 oben,
  `connectNulls=false` → sichtbare Lücken), Klickzahlen, Providerstatus,
  Credits, Alerts, Top-25-Vorschau.
- Buchdetail: Editionsumschaltung, alle KPIs, Providervergleich,
  Klick-Overlay + Annotationen, Snapshot-Tabelle, Export.
- Top 25: Cover-Grid (5/3/2 Spalten) ↔ Tabelle, Snapshot-Auswahl + Vergleich,
  Filter (Neueinsteiger/Aufsteiger/eigene Titel), eigenes Buch hervorgehoben,
  CSV/JSON-Export.
- Kategorien: Auflösung (Rainforest-Suche mit vollständigen Pfaden),
  Mapping-Verifizierung, Aktivierung, Intervall-Override.
- Provider: Status, Latenz, Fehlerrate, Circuit Breaker, Capabilities, OAuth-
  Status (nur ja/nein), Credits + Prognose, Test-Connection.
- Einstellungen: Feature-Flag, Intervalle (Presets), Prioritäten, Retention,
  Digest, Alerts, Budget, Baseline-Import, manueller Refresh.

## Bekannte Grenzen

- Amazon aktualisiert Verkaufsränge selbst nur periodisch; `providerUpdatedAt`
  ist nicht sekundengenau. Provider können zeitversetzt unterschiedliche
  Werte liefern (Abweichung ≠ Fehler).
- `websiteSalesRank`/Kategorieränge können in einzelnen Antworten fehlen;
  Amazon liefert oft nur „relevante" Kategorien.
- Creators API setzt ein aktives Associates-Konto mit API-Zugang voraus
  (≥ 10 qualifizierte Verkäufe/30 Tage); Rainforest verbraucht Credits pro
  Request.
- Vercel Hobby erlaubt nur tägliche Crons – stündliches Tracking benötigt den
  mitgelieferten externen Pinger oder Vercel Pro (dokumentiert).
- Verkaufszahlen sind aus Rängen nicht ableitbar; nur die optionale, klar
  gekennzeichnete Rainforest-Schätzung wird angezeigt.
- Klick-/Rang-Zusammenhänge sind Korrelationen, keine Conversions.
