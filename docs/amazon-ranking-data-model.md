# Amazon Buchrankings – Datenmodell

Alle Tabellen sind additiv (Migration `20260829170003_amazon_ranking`),
Zeitstempel UTC (`Timestamptz`), Anzeige Europe/Berlin. Drei Zeitpunkte
werden strikt unterschieden und nie vermischt:

- `fetchedAt` – tatsächlicher Abrufzeitpunkt beim Provider
- `observedAt` – Messzeitpunkt der Zeitreihe (Minuten-Bucket)
- `providerUpdatedAt` – Zeitstempel laut Provider (falls geliefert)

## Kernmodelle

| Modell                        | Zweck                                                                 |
| ----------------------------- | --------------------------------------------------------------------- |
| `AmazonBook`                  | Logisches Buch (unabhängig von Ausgaben), `primaryEditionId`          |
| `AmazonEdition`               | ASIN-spezifische Ausgabe (Format, ISBN, Vorbestellstatus, Cover, Preis, `trackedShortCode` für die Klick-Verknüpfung, ASIN-Validierung). Unique `[marketplace, asin]`. Ränge werden nie editionsübergreifend vermischt. |
| `AmazonCategory`              | Beobachtete Kategorie; `categoryType`: `WEBSITE` (Pseudo-Kategorie für den Gesamtbuchrang → uniforme Zeitreihen), `BROWSE_NODE` (Kategorierang), `BESTSELLERS` (Top-25-Liste). `required` (Sachbücher), `autoFollow`, `leaderboardEnabled`, Intervall-Override, `resolutionStatus`. |
| `AmazonCategoryProviderMapping` | Browse-Node-ID (Creators) ↔ Rainforest-Kategorie-ID inkl. Pfad/URL, `verified` (Admin-Bestätigung bei Mehrdeutigkeit). Unique `[categoryId, provider, providerCategoryId]`. |
| `AmazonEditionCategory`       | In welchen Kategorien die Edition (jemals) gerankt war: Auto-Discovery, `currentlyRanked`, first/lastSeen. |

## Zeitreihen

| Modell                          | Zweck                                                              |
| ------------------------------- | ------------------------------------------------------------------ |
| `AmazonRankObservation`         | Rohbeobachtung EINES Providers. `rank` positiv oder NULL (nie 0), `sourceStatus` LIVE/PARTIAL/CACHED/MANUAL, `canonical`, `discrepancyFlag`, `providerDifference`, `payloadHash`, `runId`. Unique `[editionId, categoryId, provider, observedAt]` → idempotente Upserts. |
| `AmazonCanonicalRankSnapshot`   | Kanonischer Wert pro Messzeitpunkt: Auswahlgrund (`creators_fresh`, `rainforest_fallback`, `stale_last_value`, `data_gap`, `manual_baseline`), `stale`, `dataGap`, Referenzen auf beide Beobachtungen. Unique `[editionId, categoryId, observedAt]`. |
| `AmazonLeaderboardSnapshot` / `AmazonLeaderboardEntry` | Top-25-Snapshot: `position` (Ergebnisposition) + `bestsellerRank`, alle Anzeige-Snapshots (Titel, Autor, Cover-URL, Preis, Bewertung), `editionId` bei eigenem Buch, `complete`/`partialReason`. Reihenfolge exakt wie geliefert. |
| `AmazonProductMetadataSnapshot` | Preis/Verfügbarkeit/Bewertung/Cover je Provider und Zeitpunkt.     |

## Betrieb & Überwachung

| Modell                 | Zweck                                                                  |
| ---------------------- | ---------------------------------------------------------------------- |
| `AmazonProviderRun`    | Laufhistorie: Job, Provider, Status, Versuche, Requests, Credits, Latenz, Fallback-Herkunft, Fehlerklasse + redigierte Meldung, Correlation-ID. |
| `AmazonProviderStatus` | Aktueller Zustand je Provider: configured/healthy, Fehler in Folge, Circuit-Breaker (closed/open/half_open), Latenz, redigierter Quota-Status. |
| `AmazonJobState`       | Scheduler: Intervall-Override, `nextRunAt`, verteilter Lock (`lockedUntil`/`lockOwner`), letzter Status. |
| `AmazonRawPayload`     | Redigierte Rohantwort (kein api_key, keine Tokens, keine E-Mails, kein HTML) für Fehlersuche; Aufbewahrung max. 30 Tage. |

## Alerts, Digest, Kontext

| Modell                 | Zweck                                                                 |
| ---------------------- | ---------------------------------------------------------------------- |
| `AmazonAlertRule`      | Konfigurierbare Regel (Metrik, Operator, Schwelle, Kategorie, Kanäle, Cooldown). |
| `AmazonAlertEvent`     | Ausgelöste Alerts (Dedupe über `dedupeKey` + Cooldown, Historie).      |
| `AmazonAnnotation`     | Kampagnen-/Ereignismarker für Charts und Korrelationen.               |
| `AmazonDigestRun`      | Tägliche Zusammenfassung; Unique `[calendarDate, timezone, recipient]` erzwingt Einmaligkeit. |
| `AmazonSalesEstimate`  | Externe SCHÄTZUNG (Bandbreite, Methodik, Provider) – immer als Schätzung gekennzeichnet. |
| `AmazonActualSalesImport` | Importierte ECHTE Verkaufszahlen (Quelle, Importeur) – strikt getrennt, werden nie von Schätzungen überschrieben. |

## Aufbewahrung

- Beobachtungen + kanonische Snapshots: unbegrenzt (Standard;
  `AMAZON_RANK_RETENTION_DAYS` optional).
- Leaderboard-/Metadaten-Snapshots: unbegrenzt gespeichert (Empfehlung
  ≥ 24 bzw. ≥ 12 Monate ist damit erfüllt).
- Redigierte Rohpayloads: `AMAZON_RAW_PAYLOAD_RETENTION_DAYS` (Standard 30).
- Secrets: in keiner Tabelle. HTML: wird nie gespeichert.
