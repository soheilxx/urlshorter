# Amazon Buchrankings – Betrieb

## Scheduler

Ein Tick (`GET/POST /api/cron/amazon`, Bearer `CRON_SECRET`) führt alle
fälligen Jobs aus. Fälligkeit, Intervalle und verteilte Locks liegen in
`AmazonJobState` – ein Tick darf beliebig oft aufgerufen werden (idempotent,
Doppelstarts werden über bedingte Lock-Updates verhindert).

| Job                                | Standardintervall | Inhalt                                            |
| ---------------------------------- | ----------------- | ------------------------------------------------- |
| refresh-primary-book-ranks         | 60 min            | Buch-/Kategorienränge beider Provider (parallel)  |
| refresh-category-leaderboards      | 180 min           | Top-25-Listen (Rainforest)                        |
| refresh-product-metadata           | 24 h              | Cover/Metadaten (Creators, Batch, Cache)          |
| resolve-amazon-categories          | täglich           | Rainforest-Kategorie-IDs auflösen                 |
| refresh-provider-health            | 15 min            | OAuth-/Account-Check beider Provider              |
| refresh-rainforest-account-status  | 6 h               | Credits/Plan (kostenlose Account API) + Warnungen |
| send-daily-ranking-digest          | Prüfung alle 30 min | 1×/Kalendertag ab 08:00 Europe/Berlin           |
| cleanup-provider-payloads          | täglich           | redigierte Rohpayloads > 30 Tage löschen          |

Alle Intervalle sind im Dashboard (Einstellungen) ohne Deployment änderbar;
pro Kategorie ist ein Override möglich.

### Aufrufer

- **Vercel Cron** (`vercel.json`): `/api/cron/amazon` täglich 06:00 UTC.
  Achtung: Der Vercel-**Hobby**-Plan erlaubt nur tägliche Crons.
- **Externer Pinger** (empfohlen für stündliches Tracking):
  GitHub-Actions-Workflow `.github/workflows/amazon-scheduler.yml`
  (alle 30 Minuten). Aktivierung:
  1. Repository-**Variable** `AMAZON_TICK_URL` =
     `https://lizenzzumerfolg.com/api/cron/amazon`
  2. Repository-**Secret** `CRON_SECRET` = Wert aus Vercel
  Ohne die Variable bleibt der Workflow inaktiv. Alternativ funktioniert
  jeder Cron-Dienst (z. B. cron-job.org) mit demselben Bearer-Header –
  oder Vercel Pro mit `"schedule": "*/30 * * * *"`.

### Manuelle Bedienung

- Dashboard → Einstellungen → „Manueller Refresh" (nur ADMIN, Rate-Limit
  2 min/Job, Lock-geschützt, Ergebnis als ProviderRun sichtbar).
- Direkt per HTTP (nur mit `CRON_SECRET`):
  - `?job=<jobType>` führt genau EINEN Job aus (kontrollierter Live-Test),
  - `?summary=1` liefert den Modulstatus ohne Secrets (Edition inkl.
    ASIN-Validierung, Kategorien/Mappings, Providerstatus, letzte kanonische
    Ränge, Leaderboards, letzte Läufe inkl. sicherer Fehlermeldungen).

## Datenlücken, Stale & Fallback

- Eine fehlgeschlagene Messung wird NIE als unveränderter Rang gespeichert;
  der kanonische Snapshot trägt `stale` (letzter bekannter Stand) oder
  `dataGap` (kein Vorwert). Charts lassen Lücken sichtbar (keine
  Interpolation).
- Fallbacks: Rainforest übernimmt kanonisch, wenn Creators ausfällt (Alert
  „Fallback aktiv"); Bestseller-Abruf fällt auf die gespeicherte URL zurück;
  Leaderboard-Ansichten zeigen den letzten Snapshot mit Stale-Badge.
- Sichtbar in der UI: letzter erfolgreicher Abruf je Provider, Fehler in
  Folge, Circuit-Breaker-Status, nächster Versuch (Scheduler-Status).

## Credits & Budget

- Warnstufen: < 30 % Hinweis, < 20 % Warnung, < 10 % kritisch,
  Prognose > Restbudget → Prognosewarnung (Alerts + Provider-Seite).
- Optionales Tagesbudget (`Einstellungen`): Jobs, die es überschreiten
  würden, werden mit Status SKIPPED übersprungen.
- Prognoserechnung (`src/lib/amazon/quota.ts`) aus den aktuellen
  Einstellungen; Standardbeispiel: Buch stündlich ≈ 24 + fünf Kategorien
  alle 3 h ≈ 40 → ≈ 64 Requests/Tag ≈ 1.920/30 Tage.

## Alerts & Digest

- Systemalerts: neuer Bestwert, Schwellen-Eintritte (Top 100k…100 bzw.
  Top 100…1), auffällige Sprünge (≥ 25 % und ≥ 5 Plätze), neue Kategorie,
  Top-25-Ein-/Austritt, Preis-/Verfügbarkeits-/Vorbestell-/Bewertungs-
  Änderung, Provider down / Fallback / Circuit offen, Credit-Stufen.
- Eigene Regeln (Einstellungen): Metrik (Rang, Bewegung Plätze/Prozent),
  Operator, Schwelle, Kategorie, Cooldown, Kanäle. Dedupe über
  `dedupeKey` + Cooldown; Historie unter Übersicht → Alerts.
- Digest: höchstens 1× pro Kalendertag/Zeitzone/Empfänger
  (DB-Unique-Constraint), erster erfolgreicher Lauf ab konfigurierter
  Uhrzeit; Inhalt als JSON am `AmazonDigestRun` (Historie in den
  Einstellungen). E-Mail-Versand folgt automatisch, sobald die
  Mail-Infrastruktur des Projekts konfiguriert ist (`lib/mailer.ts`).

## Exporte

- `/api/export/amazon?type=ranks|observations|leaderboard&format=csv|json`
  (Session-geschützt; leaderboard zusätzlich `&snapshotId=`).
- UI-Buttons: Buchdetail (Ranks/Beobachtungen), Top 25 (Snapshot).

## Fehlerbehebung

| Symptom                              | Prüfen                                                        |
| ------------------------------------ | ------------------------------------------------------------- |
| „nicht konfiguriert"                 | Env-Variablen in Vercel (richtige Umgebung), Redeploy         |
| Creators auth-Fehler                 | Credential-Version ↔ Token-Endpoint (3.2 = api.amazon.co.uk), Partner-Tag, API-Freischaltung im Associates-Konto |
| Rainforest quota-Fehler              | Credits im Rainforest-Dashboard, Tagesbudget-Einstellung      |
| Keine Top-25-Liste                   | Kategorie aufgelöst + Mapping verifiziert + „Top 25" aktiv    |
| Jobs laufen nicht                    | Externer Pinger/Cron erreichbar? `?summary=1` → lastRuns; Modul aktiv? |
| Circuit offen                        | Provider-Seite; öffnet sich nach 10 min automatisch half-open |
| Digest fehlt                         | Digest aktiviert, Uhrzeit erreicht, Tick nach 08:00 gelaufen  |

## Backup & Retention

- Rankingbeobachtungen + kanonische Snapshots: unbegrenzt
  (`AMAZON_RANK_RETENTION_DAYS=0`); Leaderboard-/Metadaten-Snapshots bleiben
  erhalten; redigierte Rohpayloads max. 30 Tage (Cleanup-Job).
- Datenbank-Backups laufen über den Postgres-Anbieter (wie übriges System);
  alle Amazon-Tabellen sind Teil desselben Schemas.
