# Amazon Buchrankings – Provider

Beide Provider liegen hinter einer Capability-Abstraktion
(`src/lib/amazon/provider-types.ts`); Zuständigkeiten und Fallbacks sind fest
definiert (`docs/amazon-ranking-architecture.md`).

## Amazon Creators API

- **Auth**: OAuth 2.0 Client Credentials. Token-Endpoint nach
  Credential-Version (3.1 → api.amazon.com, 3.2 → api.amazon.co.uk,
  3.3 → api.amazon.co.jp; überschreibbar via `AMAZON_CREATORS_TOKEN_URL`),
  Scope `creatorsapi::default`, Token 3600 s. Serverseitiger Cache mit
  120 s Sicherheitsabstand und Single-Flight-Lock gegen parallele
  Erneuerungen (`src/lib/amazon/providers/creators.ts`).
- **Requests**: `POST https://creatorsapi.amazon/catalog/v1/getItems`, Header
  `Authorization: Bearer`, `Content-Type: application/json`,
  `x-marketplace: www.amazon.de`. Felder lowerCamelCase; max. 10 ASINs pro
  Batch (automatisches Batching). Ressourcen: browseNodeInfo (inkl. ancestor
  + salesRank + websiteSalesRank), images.primary.*, itemInfo.*, parentASIN,
  offersV2.listings (availability, price, isBuyBoxWinner).
- **Zuordnung** ausschließlich über die ASIN, nie über Array-Positionen;
  nicht zugängliche Items erscheinen im `errors`-Container und werden als
  partial/fehlend behandelt.
- **Eigenheiten**: `websiteSalesRank` kann fehlen; nicht jeder Browse Node
  hat einen Rang; Amazon liefert oft nur „relevante" Kategorien; Browse-Node-
  ID + Ancestor-Hierarchie sind maßgeblich (kein String-Matching).
- **Token-Sicherheit**: Credential Secret und Access Token werden nie
  gespeichert, geloggt oder in Fehlerobjekte aufgenommen
  (`safeErrorMessage`/`redactSecrets`).

## Rainforest API

- **Produkt**: `GET /request?type=product&amazon_domain=amazon.de&asin=…`
  (+ `associate_id`, `output=json`, `include_html=false`). Liefert
  `bestsellers_rank` (Gegenprüfung; „Bücher" = Gesamtrang), Preis, Bewertung,
  Verfügbarkeit, Vorbestellstatus, Spezifikationen (ISBN).
- **Top 25**: `GET /request?type=bestsellers&category_id=…&page=1`. Fallback
  innerhalb Rainforests: Abruf über die gespeicherte Bestseller-URL
  (`url=`-Parameter), falls die Kategorie-ID nicht mehr funktioniert. Es
  werden nur die ersten 25 EINDEUTIGEN Einträge übernommen; Reihenfolge
  unverändert, fehlende Plätze werden nie erfunden, < 25 Einträge → partial.
- **Kategorien**: `GET /categories?domain=amazon.de&type=bestsellers&
  search_term=…` – die Sachbuch-Kategorie wird dynamisch aufgelöst; bei
  mehreren Treffern zeigt der Adminbereich die vollständigen Pfade zur
  Auswahl (korrekt ist der Pfad unter dem deutschen Bücherbereich).
- **Account** (kostenlos): `GET /account` – Plan, Credits, Reset, Overage,
  Plattformstatus. `api_key`/E-Mail werden vor jeder Speicherung entfernt.
- **Key-Sicherheit**: Der API-Key wird nur serverseitig an die URL angehängt;
  `redactSecrets` entfernt ihn aus allen Logs, Fehlermeldungen und
  gespeicherten Payloads (`request_metadata.amazon_url` etc.).

## Abgleich & kanonische Auswahl

Beide Beobachtungen werden IMMER getrennt gespeichert
(`AmazonRankObservation`). Kanonische Auswahl pro Messzeitpunkt
(`src/lib/amazon/canonical.ts`):

1. Amazon Creators, wenn Wert vorhanden, vollständig und frisch
   (`staleAfterMinutes`, Standard 180)
2. Rainforest, wenn Creators keinen Rang liefert / veraltet / ausgefallen
3. letzter erfolgreicher kanonischer Wert – als `stale` markiert
4. Datenlücke (`dataGap`, `canonicalRank = null` – niemals Rang 0)

Abweichung = `abs(creators − rainforest)`; relativ bezogen auf den
kanonischen Rang. Eine Abweichung ist ein Datenqualitätsindikator (Provider
aktualisieren zeitversetzt), kein automatischer Fehler; kein Wert wird
überschrieben.

## Fehlerklassifizierung & Resilienz

- `ProviderError` mit Klassen auth / rate_limit / quota / timeout / network /
  server / client / not_found / validation / not_configured.
- Retry mit exponentiellem Backoff + Jitter NUR für transiente Klassen.
- Circuit Breaker je Provider: öffnet nach 4 Fehlern in Folge, half-open nach
  10 Minuten (`AmazonProviderStatus`).
- SSRF-Allowlist (`PROVIDER_HOST_ALLOWLIST`): nur api.rainforestapi.com,
  creatorsapi.amazon und die Amazon-OAuth-Hosts werden kontaktiert;
  Bildhosts (m.media-amazon.com u. a.) werden nur verlinkt.
- Antwortgröße limitiert (5 MB), Timeouts konfigurierbar, kein HTML.
