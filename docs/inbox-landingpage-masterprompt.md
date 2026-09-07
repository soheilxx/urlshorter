# Masterprompt: Inbox-Landingpage mit Geschichte, Spende und Gewinnchance

Stand: 7. September 2026. Arbeite im bestehenden Next.js-Projekt und überarbeite `/buch-inbox` nach dem aktuellen Masterplan.

## Ziel

Erreiche Besucher aus GMX-/WEB.DE-Inbox-Ads mit einer persönlichen, gut lesbaren Buchvorstellung. Die Seite soll sowohl Menschen ansprechen, die eine wahre Lebensgeschichte lesen oder verschenken möchten, als auch Menschen, denen die Autoren-Spende oder die Gewinnchance wichtig ist. Zeige alle drei Motive früh und verständlich. Behalte die vertraute Postfach-Optik der eigenen Marke Lesepost bei.

## Copy

Beginne mit „Wer sagt, dass du das nicht kannst?“. Der Einstieg führt vom Unterschätztwerden zum eigenen Lebensweg. Erzähle anschließend konkrete, auf der Autorenseite veröffentlichte Situationen und verbinde sie zu einer persönlichen Nachricht. Microsoft kommt als ein Teil dieser Biografie vor; bei Konfliktbeginn ist Soheil 20. Keine Jahreszahl 2011, keine behauptete Gerichtsentscheidung und keine erfundenen Zitate.

Verwende klare, warme Sprache. Zeige, warum der Leser sich darin wiederfinden könnte: eigene Veränderungen und Zweifel, Interesse an wahren Geschichten, ein Geschenk mit Bedeutung. Versprich keine garantierte Lebensveränderung und stelle die Biografie nicht als Coachingprogramm dar. Die Herkunft ist kein Kaufgrund. Vermeide austauschbare Formulierungen wie „Impulse für deinen Weg“ als Ersatz für konkrete Inhalte.

## Spende

Nutze die zentrale, exakte Zusage aus `buch-config.ts`. Gestalte im Einstieg eine sichtbare 100-%-Karte mit eindeutiger Beschriftung „der Autoren-Einnahmen“ und offiziellem Kinderschutzbund-Logo. Baue zusätzlich einen großen Abschnitt „Ein Buch für dich. Ein Beitrag für Kinder.“ mit der vollständigen Zusage, Spendenempfänger-Logo und einem Amazon-CTA. Die Aussage gilt auch beim Verschenken. Erfinde keine Spendenbeträge pro Buch, keine Partnerschaft und keine Empfehlung durch den Kinderschutzbund.

## Gewinnspiel

Zeige im Einstieg sofort, was man gewinnen kann: fünf Tage Dubai für zwei Personen im Wert von 20.000 € und 100 zusätzliche Wertgutscheine. Übernimm alle Zahlen, Fristen und den Status aus `gewinnspiel-config.ts`. Erkläre früh, dass Bestellung und Registrierung erforderlich sind.

Im ausführlichen Abschnitt: Reisebestandteile entsprechend den Teilnahmebedingungen, Gutschein-Staffeln, drei Teilnahmeschritte, Bestell-CTA, Link für bereits Bestellende zu `/gewinn#teilnahme`, Link zu Teilnahmebedingungen. Formuliere eine Gewinnchance, keinen sicheren Gewinn. Sobald die zentrale Phase nicht mehr offen ist, keine Aufforderung zu einer aktuell möglichen Teilnahme ausgeben; stattdessen zum Gewinnspielstatus verweisen.

## Oberfläche

GMX-Blau und WEB.DE-Gelb sowie automatischer System-Dark-Mode bleiben. Das Logo lokal und unverändert einbinden, mit weißem Hintergrund in beiden Themes. Eine zusammenhängende Geschichte mit kurzen Absätzen, sichtbaren Stationen und klaren Zwischenüberschriften. Die Spenden- und Gewinnflächen müssen deutlich stärker auffallen als gewöhnliche Randnotizen.

Mobil keine horizontale Scrollfläche. Die zwei Vorteilskarten und der erste Bestell-Button sollen bereits im Einstieg sichtbar sein. Desktop: Ordnernavigation, Nachricht, Buchkarte. Merken/Teilen, FAQ und Sticky-CTA weiter nutzbar, Bedienflächen mindestens 44 Pixel.

## Technisch

Bestehende Route und Tracking nutzen. Alle Amazon-Links tragen `data-gw-event="buch_amazon_klick"` und eindeutige `data-cta-id`. Neue Placements `inbox-charity` und `inbox-giveaway`. Besuch = PageView, Amazon-Klick = AddToCart. Interne Navigation und Gewinnspielregistrierung lösen keinen Amazon-ATC aus. Tracking-Geheimnisse nicht ausgeben. Keine Änderungen an den anderen Kampagnenseiten.

## Fertigstellung

Produktionsbuild, vorhandene Browsermatrix und Interaktionen prüfen, externe Werbeendpunkte im Test blockieren. Screenshots auf kleinen und großen Displays in beiden Themes ansehen, falls nötig nachbessern. Veröffentlichte Version prüfen. Ein gemessener Conversion-Uplift darf erst nach Kampagnendaten behauptet werden. Die Umsetzung, Quellen und Prüfergebnisse dokumentieren.
