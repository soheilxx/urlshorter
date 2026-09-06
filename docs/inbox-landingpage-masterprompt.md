# Masterprompt: Inbox-Landingpage für Die Lizenz zum Erfolg

Erstelle und veröffentliche im bestehenden Repository `urlshorter` eine zusätzliche Landingpage unter `/buch-inbox` für Besucher aus GMX- und WEB.DE-Inbox-Ads. Arbeite den folgenden Auftrag vollständig ab. Der vorgeschaltete Masterplan ist `docs/inbox-landingpage-masterplan.md`; seine Recherche und verbindlichen Fakten sind die Grundlage. Technische Detailentscheidungen darfst du im vorhandenen Next.js-/React-/CSS-Module-Stil selbst treffen.

## Zielbild

Die Seite fühlt sich wie eine geöffnete, gut lesbare Nachricht an. Sie heißt **Lesepost**, zeigt die Buchmarke **Die Lizenz zum Erfolg** und den tatsächlichen Autor **Soheil Hosseini** als Absender. Kennzeichne sie im sichtbaren Mail-Kopf als **Buchvorstellung · Anzeige**. Nutze vertraute Postfach-Muster: schmale linke Navigation, Betreff, Absenderfoto, Merken-Stern, Weiterempfehlen und einen ruhigen Lesebereich. Die tatsächliche Bestellung führt eindeutig zu Amazon.

Verwende keine GMX-/WEB.DE-Logos, Kontoanmeldung, fingierte privaten E-Mails, Bestellbestätigungen oder Support-Absender. Stelle nur echte Seiteninhalte als Navigation dar. Der Merken-Stern zeigt die eigene lokale Auswahl. Die Reddit-Votes werden nicht in eine unpassende Mail-Bedienung übertragen.

## Ansprache und Story

Schreibe auf Deutsch in der Ich-Perspektive des beauftragenden Autors, mit freundlicher Du-Ansprache. Kurze Absätze, natürliche Sprache, konkrete Gedanken. Die Seite soll Leser von Biografien ebenso ansprechen wie Menschen, die beruflich oder persönlich etwas bewegen wollen. Schreibe eine persönliche Buchvorstellung, keinen als Original ausgegebenen Buchauszug. Keine Erfolgsversprechen, Prozesssiege oder erzählerischen Szenen erfinden.

Die Hook lautet: **„Mit 20 stand ich Microsoft gegenüber.“**

Mail-Einstieg sinngemäß, im Layout kurz halten:

> Hallo, ich bin Soheil. Ich bin gerade einmal 20, als meine erste Auseinandersetzung mit Microsoft beginnt. Aus diesem Moment wird ein Konflikt, der mich über Jahre begleitet.

Direkt dazu die Perspektive öffnen:

> In „Die Lizenz zum Erfolg“ erzähle ich von meinem Weg, meinen Entscheidungen und dem Aufbau eigener Unternehmen. Eine Lebensgeschichte für alle, die sich fragen, wie sie ihren eigenen Weg gehen möchten.

Kein Jahr 2011 nennen. Die Altersangabe 20 ist die verbindliche Hook. Herkunft nur kurz bei der persönlichen Biografie verwenden, niemals als einen der drei Kaufgründe. Kindheit im Iran, Umzug nach Deutschland mit sechs, alleinerziehende Mutter; Unternehmen in Software, Finanzen und Mode sind vorgegebene Eckdaten.

Die drei Kaufgründe müssen Identifikation und Nutzen ausdrücken. Verwende diese Richtung:

1. **Du willst den nächsten Schritt wagen.** Eigenes Projekt, beruflicher Neustart, Selbstständigkeit. Persönliche Entscheidungen eines Unternehmers geben Einblicke und mögliche Impulse für die eigenen Vorhaben.
2. **Du willst dir treu bleiben. Auch bei Gegenwind.** Widerstände im Alltag und im Beruf; die Frage, wofür man einsteht. Der Microsoft-Konflikt ist ein persönlicher Bezugspunkt, kein pauschaler Beweis, dass jeder Widerstand zum Sieg führt.
3. **Du willst Erfolg nach deinen Maßstäben.** Was ist dem Leser wichtig: Freiheit, Anerkennung, etwas Eigenes schaffen? Die Biografie bietet Anlass zur Reflexion über persönliche Prioritäten. Formuliere für Bücherleser, nicht ausschließlich für Unternehmensgründer.

Zum Abschluss eine persönliche Einladung zum Weiterlesen, Signatur „Soheil“ mit ausgeschriebenem Namen und vorhandenes Autorenfoto. „Fertige Lebensläufe“, „Du musst ihn nicht feiern“ und herablassende Vergleiche entfallen.

## Verbindliche Buchdaten

Importiere Fakten aus `src/lib/buch-config.ts`: Die Lizenz zum Erfolg; Business ohne Plan, Ausreden oder Kompromisse; Soheil Hosseini; Deutscher Wirtschaftsbuch Verlag; Taschenbuch; 18 €; ISBN 9783690662505; Erscheinung 6. Oktober 2026.

Verwende `AMAZON_PRODUCT_URL` aus `src/lib/gewinnspiel-config.ts`. Alle Bestellbuttons tragen **„Bei Amazon bestellen“**. Vorbestellen nicht als sichtbare Aufforderung verwenden; den tatsächlichen Erscheinungstermin bei den Produktangaben nennen.

Der früh sichtbare Spendenhinweis ist exakt `SPENDEN_HINWEIS`:

> Die gesamten Einnahmen des Autors aus diesem Buch fließen an den Kinderschutzbund.

Ergänze keine Aussagen über den Verlagsanteil, keine veränderte Spendenzusage und keine offizielle Partnerschaft mit dem Empfänger. Nutze Cover `/gewinn/buchcover.jpg` und Porträt `/gewinn/autor.jpg`.

## Design und Funktion

Desktop: Postfach-Kopf, linke Inhaltsnavigation, breite geöffnete Nachricht, ergänzende Buchkarte rechts. Eine klare Hierarchie vom Betreff zum Inhalt, maximal etwa 660 Pixel breite Lesespalte, angemessene Weißräume und dezente Trennlinien. Die Buchkarte darf kleben, ohne den Inhalt zu verdecken.

Mobil: eine Spalte, kompakter Absender-/Aktionsbereich, große lesbare Hook, kurze Einleitung, kompakte Buchkarte mit frühem CTA. Kein seitliches Scrollen ab 320 Pixel. Interaktionen haben mindestens 44 Pixel Zielgröße. Keine Bestellleiste über dem ersten CTA; erst nach dessen Wegscrollen und vor dem Footer sichtbar. System-Dark-Mode in beiden Farbvarianten; Admin-Cookies dürfen das Seiten-Theme nicht verfälschen.

Definiere die festen Varianten `gmx` (Blau) und `webde` (Gelb mit dunkler Schrift), plus neutrale blaue Standardansicht. Auswahl über `portal`, dann `utm_source`, dann bekannten Referrer-Host, andernfalls Standard. Unbekannte Parameter werden ignoriert. Referrer streng als URL/Hostname prüfen, keine Teilstring-Zuordnung fremder Domains. Der normale Kampagnenlink funktioniert ohne Portalparameter. UIM trennt laut aktueller Spezifikation die Portal-Attribution nicht; erfinde keine verlässliche Quelle.

Merken: lokaler Browserzustand mit Rücknahme, korrektem `aria-pressed` und verständlicher Statusmeldung. Weiterempfehlen: Web Share, Clipboard, manueller Link-Fallback; keine Nachricht automatisch versenden. Inhaltsnavigation springt zu bestehenden Abschnitten. Vier native FAQ decken Genre/Inhalt, Zielgruppe, Autoren-Einnahmen und Bestellung ab. Strukturierte Buchdaten, Canonical, OG-Metadaten, Impressum und Datenschutz ergänzen. Alle wesentlichen Inhalte sind serverseitig gerendert und ohne JavaScript nutzbar.

## Tracking

Wiederverwende die vorhandenen Komponenten `GewinnTracking`, `BookConversionTracking` und `RedditTracking` sowie deren signierte Serverkonfiguration. Gib `/buch-inbox` in beiden Kontext-Schemas frei. Verwende den auf den Buch-Kampagnenseiten etablierten Consent-Betriebsmodus. Verändere die bestehenden Routen nicht.

Sichtbarer Besuch erzeugt PageView bzw. Reddit PageVisit, echter Amazon-CTA-Klick AddToCart; alle CTA-Platzierungen identifizierbar. Verwende `data-gw-event="buch_amazon_klick"` und eindeutige `data-cta-id`. Bestehende UTM-Erfassung, Event-ID-Deduplizierung, Schutz gegen synthetische Klicks und Same-Origin-Verifikation erhalten. Merken, Teilen, Menü und FAQ sind keine ATCs. Keine erfundenen UIM-Pixel-IDs; UIM-eigene Conversion-Anbindung nur als tatsächlich konfiguriert melden, wenn diese vorhanden ist.

## Lieferung und Prüfung

Arbeite in einem sauberen Branch auf aktuellem `origin/main`; vorhandene Nutzeränderungen erhalten. Erstelle kleine verständliche Komponenten unter `src/components/inbox-book/` und passende Konfigurations-/Testdateien. Prüfe Variantenwahl, neue signierte Trackingroute, UI-Funktionen, sofortigen PageView und ATC nur für Amazon. Alle lokalen externen Werbeanfragen mocken.

Prüfe Light/Dark, GMX/WEB.DE, 320/390/768/1440 Pixel, Überläufe, Bilder, Tastatur, Merken nach Reload, Sharing-Fallback, FAQ und Sticky-CTA. Produktionsbuild und passende Tests müssen erfolgreich sein. Screenshots ansehen und Layoutprobleme beheben. Veröffentliche über den bestehenden GitHub-/Vercel-Weg und bestätige Live-Status und HTTP-Inhalt.

Liefere Masterplan, diesen Masterprompt, eine kurze Abnahme mit Prüfresultaten und den gemeinsamen Kampagnenlink. Ergänze die optionalen Variantenlinks und die Anzeigen-Starttexte: Absender „Soheil Hosseini“, Betreff „Mit 20 gegen Microsoft“, Preheader „Eine Lebensgeschichte. Impulse für deinen Weg.“ Anzeigen werden nicht automatisch gebucht oder verschickt.
