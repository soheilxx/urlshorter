# Inbox-Landingpage: Masterplan

Aktueller Stand: 7. September 2026. Dieser Plan ersetzt die Erstfassung vom 6. September und berücksichtigt die Rückmeldungen zur Geschichte, Spende und zum Gewinnspiel. Ziel bleibt `/buch-inbox` für GMX-/WEB.DE-Inbox-Ads.

## Ziel und psychologische Gestaltung

Drei eigenständige Bestellmotive früh sichtbar machen: eine persönliche Lebensgeschichte lesen, mit der Autoren-Spende den Kinderschutzbund unterstützen und nach registrierter Buchbestellung am Gewinnspiel teilnehmen. Eine verständliche Entscheidung ermöglichen, ohne dem Leser Business-Interesse vorauszusetzen.

Die neue Hook „Wer sagt, dass du das nicht kannst?“ eröffnet ein breites Thema: unterschätzt werden und den eigenen Weg finden. Der kurze Einstieg nennt den biografischen Zusammenhang. Die anschließende Nachricht erzählt konkrete Situationen, damit sich der Leser auf einen Menschen einlassen kann. Microsoft ist ein Abschnitt des Lebenswegs. Die drei Lesegründe sprechen Veränderung und Selbstzweifel, Freude an wahren Geschichten sowie ein Geschenk mit Bedeutung an.

Die erwartete Wirkung ist eine Gestaltungshypothese. Ob die Seite mehr Amazon-Klicks oder Bestellungen bewirkt, muss mit Kampagnendaten gemessen werden. Kein behaupteter Conversion-Uplift und keine psychologischen Garantien.

## Quellen und Faktenbasis

- [Autorenseite und Buchvorstellung](https://www.soheil-hosseini.de/): veröffentlichte Buchinhalte und Erzählmomente. Neue Werbecopy in der Ich-Perspektive, kein als Originalauszug ausgegebener Text. Kein erfundener Prozessausgang oder zusätzlicher Dialog.
- [Offizielle Kinderschutzbund-Website](https://kinderschutzbund.de/): Quelle des unveränderten Logos. Datei: `https://kinderschutzbund.de/wp-content/uploads/2022/05/DKSB_Bundesverbands.svg`. Lokal unter `public/inbox/kinderschutzbund.svg`; bezeichnet den Spendenempfänger, keine behauptete Kooperation oder Empfehlung des Buches.
- `src/lib/buch-config.ts`: verbindliche Buchdaten und exakte Betreiberzusage: „Die gesamten Einnahmen des Autors aus diesem Buch fließen an den Kinderschutzbund.“ 100 % meint ausschließlich die Autoren-Einnahmen. Keine erfundene Euro-Spende je Exemplar.
- `src/lib/gewinnspiel-config.ts` und [veröffentlichte Teilnahmebedingungen](https://lizenzzumerfolg.com/gewinn/teilnahmebedingungen): Hauptgewinn, Gutscheinpreise, Teilnahmevoraussetzungen, Frist und dynamischer Status. Buch bestellen UND Bestellung registrieren. Der Kauf allein meldet niemanden an.
- [UIM Newsletter-DACH-Studie 2026](https://www.united-internet-media.de/de/research/online-studien/user-insights/newsletter-dach-studie-2026/): Orientierung für übersichtliche Gestaltung und erkennbaren Absender; keine direkte Buch-Conversion-Studie.
- [UIM Inbox Ad Clickout](https://www.united-internet-media.de/de/produkteundloesungen/native/inbox-ad/inbox-ad-clickout/) und [Spezifikation April 2026](https://www.united-internet-media.de/fileadmin/uim/media/home/downloadcenter/Spezifikationen/Native_Advertising/UIM_Spezifikationen_Inbox_Ad_Clickout.pdf): direkter Klick zur Landingpage, Varianten und Anzeigenfelder wie in der Erstprüfung.

## Aufbau

1. Eigene Marke Lesepost, erkennbarer Autor und Werbekennzeichnung im Postfach-Layout.
2. Breite Hook und kurzer biografischer Einstieg.
3. Zwei sofort sichtbare Karten: 100 % Autoren-Einnahmen mit Kinderschutzbund-Logo; Gewinnchance mit fünf Tagen Dubai für zwei, 20.000 € Reisewert und 100 zusätzlichen Wertgutscheinen.
4. Kompakte Buchkarte, 18 €, erster Amazon-CTA, kurzer Hinweis auf notwendige Gewinnspielregistrierung.
5. Zusammenhängende Geschichte mit konkreten Stationen: Schule, erste Versuche, Rückschlag, Microsoft-Konflikt mit 20 und Bogen zum gesamten Lebensweg.
6. Drei Lesegründe aus Sicht des Lesers: neuer Mut, Mitfühlen beim Lesen, Geschenk mit Bedeutung.
7. Große Spendenfläche: 100 %, exakte Zusage, gut lesbares offizielles Logo, eigenes Bestellangebot.
8. Gewinnspiel mit Dubai-Skyline, Reisebestandteilen, Gutschein-Staffeln, drei Teilnahmeschritten und Links zu Registrierung/Teilnahmebedingungen. Automatisch auf den zentralen Gewinnspielstatus reagieren.
9. Buchdetails, Autor, persönliche Einladung, FAQ und Abschlussangebot mit allen relevanten Motiven.

## Gestaltung

Bestehendes Postfach-Muster beibehalten: links Ordner, rechts Buchkarte, mittig gut lesbare Nachricht. Mobil kompakter Kopf und einspaltiger Inhalt. Beide Vorteile nebeneinander auch auf kleinen Handys; Bestell-Button früh sichtbar. Textabsätze, markierte Geschichtenstationen und eigenständige Spenden-/Gewinnflächen geben der Seite Rhythmus.

GMX-orientierte blaue und WEB.DE-orientierte gelbe Variante, beide mit System-Dark-Mode unabhängig vom Admin-Cookie. Das Kinderschutzbund-Logo bleibt unverändert auf weißem Grund, auch im Dark-Mode. Keine externe Logo-Anfrage beim Besucher.

Merken, Teilen, mobile Inhaltsnavigation, FAQ und mobile Bestellleiste funktionieren weiter. Buch und Kerninhalte sind auch ohne JavaScript nutzbar.

## Tracking und Kampagnenlinks

Route, kanonische URL, Variantenwahl und bestehende Pixel-/CAPI-Verträge bleiben bestehen. Amazon-Klicks zählen als AddToCart, Besuche als PageView beziehungsweise Reddit PageVisit. Neue Amazon-Platzierungen `inbox-charity` und `inbox-giveaway` werden wie die bestehenden Buttons erfasst. Ein Klick auf die Gewinnspielregistrierung darf kein Amazon-ATC sein.

Gemeinsamer Anzeigenlink:
`https://lizenzzumerfolg.com/buch-inbox?utm_source=uim&utm_medium=inbox_ad&utm_campaign=lizenz_zum_erfolg`

Feste Varianten über `portal=gmx` oder `portal=webde`. Referrer-Erkennung ist nur ein Fallback; sie garantiert keine Portal-Attribution. Ein UIM-eigenes Conversion-Tag liegt weiterhin nicht vor.

Anzeigen-Starttexte: Absender „Soheil Hosseini“, Betreff „Unterschätzt. Weitergemacht.“, Preheader „Ein Buch für dich. Ein Beitrag für Kinder.“. Alternative Spenden-Hook „Ein Buch. Und Hilfe für Kinder.“. Keine Anzeigen werden durch diese Veröffentlichung gebucht oder versendet.

## Prüfung

Build und Typen/Lint. Bestehende Browsermatrix für 320/390/768/1440 Pixel, GMX/WEB.DE, Light/Dark: früh sichtbare Vorteilskarten und erster CTA, kein horizontaler Überlauf, geladenes Logo und Cover. Registrierung und Teilnahmebedingungen erreichbar, keine falschen Amazon-Conversions durch interne Links. Alle sieben Amazon-Platzierungen einschließlich mobiler Leiste prüfen. Screenshots visuell beurteilen. Nach Deployment Live-Inhalte und beide Varianten prüfen.
