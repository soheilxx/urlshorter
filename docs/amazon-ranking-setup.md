# Amazon Buchrankings – Setup

## Voraussetzungen

1. **Amazon Creators API** (Nachfolger der PA-API 5):
   - Aktives Amazon-PartnerNet-/Associates-Konto mit API-Zugang
     (mindestens 10 qualifizierte Verkäufe in 30 Tagen).
   - In Associates Central API-Credentials erzeugen: Credential ID,
     Credential Secret, Credential-Version (DE = 3.2), Partner-Tag.
2. **Rainforest API** (https://app.rainforestapi.com): API-Key aus dem
   Dashboard; die Account API ist kostenlos, Produkt-/Bestseller-Requests
   verbrauchen Credits.

## Environment-Variablen

Alle Variablen stehen dokumentiert in `.env.example` (Abschnitt „Amazon
Buchrankings"). Secrets gehören ausschließlich in:

- **Vercel → Project → Settings → Environment Variables** (Production;
  Preview nur wenn wirklich nötig), und/oder
- lokal in `.env.local` bzw. `.env` (gitignored).

Pflicht für den Vollbetrieb:

```
AMAZON_RANKING_ENABLED=true
RAINFOREST_API_KEY=…                    # GEHEIM
AMAZON_CREATORS_CREDENTIAL_ID=…         # GEHEIM
AMAZON_CREATORS_CREDENTIAL_SECRET=…     # GEHEIM
AMAZON_CREATORS_CREDENTIAL_VERSION=3.2  # DE
AMAZON_CREATORS_PARTNER_TAG=…
```

Niemals `NEXT_PUBLIC_`-Varianten anlegen – alle Werte werden ausschließlich
serverseitig gelesen. Der Build funktioniert auch ohne gesetzte Secrets
(Provider melden dann „nicht konfiguriert").

## Rollout-Schritte

1. **Migrationen**: laufen automatisch im Vercel-Build
   (`prisma migrate deploy && next build`); alle Amazon-Tabellen sind additiv.
2. **Secrets prüfen**: Dashboard → Amazon Rankings → Provider →
   „Test Connection" (serverseitig; zeigt nur ok/Fehler + Latenz, nie Secrets).
3. **Buchdatensatz**: Übersicht → „Ersteinrichtung + Rang-Abruf starten"
   (legt Buch, Edition ASIN 3690662508 und Pflichtkategorien an und führt den
   ersten Doppelprovider-Abruf aus → ASIN-Validierung).
4. **Sachbuch-Kategorie auflösen**: Kategorien → „Rainforest-Kategorien
   auflösen". Bei mehreren Treffern die vollständigen Pfade prüfen und das
   korrekte Mapping (unter „Bücher") mit „Als korrekt bestätigen" verifizieren.
   Es wird keine unbestätigte Browse-Node-ID hartcodiert.
5. **Top-25-Test**: Kategorien → „Top-25-Listen jetzt abrufen"; Ergebnis unter
   Top 25 prüfen (Cover-Grid, 25 Einträge).
6. **Scheduler aktivieren**: Einstellungen → „Modul aktiv" + Intervalle;
   externen Pinger einrichten (siehe `docs/amazon-ranking-operations.md` –
   Vercel-Hobby-Crons laufen nur täglich).
7. **Monitoring prüfen**: Provider-Seite (Health, Credits, Fehlerrate),
   Einstellungen (Scheduler-Status), Übersicht (Alerts).

## Lokale Entwicklung

```bash
npm run db:migrate       # Migration anwenden
npm run dev              # Dev-Server
# Scheduler-Tick manuell (CRON_SECRET aus .env):
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/amazon
# Einzelnen Job ausführen:
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/amazon?job=refresh-provider-health"
# Sicherer Status ohne Secrets:
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/amazon?summary=1"
```

Tests (führen NIE echte Provider-Requests aus – nur redigierte Fixtures):

```bash
npm test                 # Unit (inkl. Rangformeln, Parser-Contracts)
npm run test:integration # gegen die lokale Test-DB
npm run test:e2e         # Playwright (UI, Rollen, mobil)
```

Ein manuell ausgelöster Live-Smoke-Test (genau ein kontrollierter Request pro
Provider) läuft ausschließlich bewusst über `?job=…` bzw. die Admin-Buttons –
niemals in CI.
