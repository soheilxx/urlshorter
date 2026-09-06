# Inbox-Landingpage: Umsetzung und Abnahme

Stand: 6. September 2026. Masterplan und Masterprompt wurden vor dem Implementieren erstellt. Umsetzung im vorhandenen Next.js-Projekt, Branch `codex/book-inbox`.

## Ergebnis

Neue Route `/buch-inbox` als geöffnete Lesepost von Soheil Hosseini. Eigene Buchmarke, Postfach-Navigation, Autor als Absender, Anzeige-Kennzeichnung, Merken-Stern und Teilen. GMX-orientierte blaue und WEB.DE-orientierte gelbe Farbwelt, jeweils mit automatischem System-Dark-Mode.

Hook: **Mit 20 stand ich Microsoft gegenüber.** Keine Jahreszahl. Persönlicher Einstieg, drei auf Leserwünsche bezogene Lesegründe, Buchdaten, Autorenporträt und vier FAQ. Herkunft erscheint nur in der kurzen Autorenbiografie. Exakter zentraler Spendenhinweis nahe dem ersten CTA. Bestelltexte lauten „Bei Amazon bestellen“.

## Kampagnenlinks

Gemeinsamer Link für die Inbox-Ad-Buchung:

`https://lizenzzumerfolg.com/buch-inbox?utm_source=uim&utm_medium=inbox_ad&utm_campaign=lizenz_zum_erfolg`

Fest gewählte Farbvarianten:

- `https://lizenzzumerfolg.com/buch-inbox?portal=gmx&utm_source=uim&utm_medium=inbox_ad&utm_campaign=lizenz_zum_erfolg`
- `https://lizenzzumerfolg.com/buch-inbox?portal=webde&utm_source=uim&utm_medium=inbox_ad&utm_campaign=lizenz_zum_erfolg`

Ohne Portalparameter kann ein bekannter GMX-/WEB.DE-Referrer die Variante wählen. Wenn er fehlt, erscheint die neutrale blaue Lesepost. Das ist keine verlässliche Portal-Attribution; laut UIM-Spezifikation werden GMX und WEB.DE nicht separat getrackt.

## Anzeigen-Starttexte

| Feld      | Text                                           |
| --------- | ---------------------------------------------- |
| Absender  | Soheil Hosseini                                |
| Betreff   | Mit 20 gegen Microsoft                         |
| Preheader | Eine Lebensgeschichte. Impulse für deinen Weg. |

Die Texte liegen innerhalb der konservativen UIM-Limits von 20/30/50 Zeichen. Die Website-Veröffentlichung bucht und versendet keine Inbox-Ads. Quellen und weitere Vorgaben stehen im Masterplan.

## Durchgeführte technische Prüfung

- `npm run build`: erfolgreich, einschließlich Typenprüfung und Lint.
- `npm run typecheck`: erfolgreich, einschließlich neuer Tests.
- ESLint auf allen neuen/geänderten TypeScript-Dateien: erfolgreich.
- 40 gezielte Unit-Tests: bestanden. Variantenwahl einschließlich fremder Hosts, signierter Kontext für die neue Route, PageView/ATC-Annahme und Ablehnung einer manipulierten Route.
- 19 Browserprüfungen: bestanden. 16 Kombinationen aus 320/390/768/1440 Pixeln, GMX/WEB.DE und Light/Dark sowie drei Funktionsprüfungen.
- Erster CTA in allen geprüften Einstiegsansichten vollständig sichtbar, auch bei 320 × 640 Pixeln. Kein horizontaler Seitenüberlauf, keine sichtbaren defekten Bilder und keine JavaScript-Laufzeitfehler.
- Admin-Theme-Cookie mit absichtlich entgegengesetzter Farbe überschreibt das System-Theme dieser Seite nicht.
- Merken lässt sich aktivieren, nach Reload wiederfinden und zurücknehmen. Sharing mit blockierter Clipboard-API bietet einen markierbaren Link. Der Link enthält keine persönlichen Klick-IDs.
- Mobile Inhaltsnavigation, FAQ, Enter-Aktivierung des Amazon-CTAs und Sichtbarkeit der unteren Bestellleiste geprüft. Die Leiste weicht dem Footer.
- Ohne JavaScript bleiben Text, Systemfarbe, FAQ und Amazon-Link nutzbar.
- Screenshots der Einstiegsansichten und vollständigen Seiten visuell geprüft.

## Tracking: überprüfter Umfang

Die neue Route nutzt das bestehende Buch-Tracking und die vorhandene Pixel-/CAPI-Konfiguration. Im lokalen Browsertest werden externe Anfragen blockiert und die First-Party-Events aufgezeichnet. Damit werden keine Test-Conversions an Werbeplattformen geschickt.

- Besuch: Book PageView und Reddit PageVisit mit Route `/buch-inbox`.
- Bewusster Amazon-Klick: AddToCart für Hero, Sidebar, Buchdetails, Abschluss und mobile Bestellleiste.
- Merken, Teilen, FAQ und ein synthetischer DOM-Klick erzeugen keinen AddToCart.
- Kampagnenparameter werden im bestehenden Eventvertrag mitgegeben; signierte Kontexte und Event-Deduplizierung bleiben erhalten.

**UIM-eigenes Conversion-Tracking:** Im Projekt liegt keine UIM-Conversion-ID bzw. kein entsprechendes Tag vor. Die Anbindung an vorhandene Werbeplattformen ist umgesetzt und geprüft; daraus folgt keine Meldung an das UIM-Kampagnenkonto. Eine von UIM gelieferte Conversion-Vorgabe wäre separat anzuschließen. AddToCart bleibt der gewünschte Proxy für den Amazon-Klick, kein Nachweis einer Bestellung.

## Dateien

- `docs/inbox-landingpage-masterplan.md`
- `docs/inbox-landingpage-masterprompt.md`
- `src/app/buch-inbox/page.tsx`
- `src/components/inbox-book/inbox-book.module.css`
- `src/components/inbox-book/interactions.tsx`
- `src/lib/inbox-book-config.ts`
- Neue Pfadfreigabe in `book-conversion-context.ts` und `reddit-context.ts`
- `playwright.inbox.config.ts` und gezielte Unit-/Browsertests

Produktionsziel: `https://lizenzzumerfolg.com/buch-inbox`. Deploymentstatus und Live-HTML werden nach dem Push zusätzlich geprüft und im Abschlussbericht bestätigt.
