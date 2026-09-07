# Inbox-Landingpage: Umsetzung und Prüfung

Stand: 7. September 2026. Überarbeitung der veröffentlichten Seite nach den Rückmeldungen zu Copywriting, Spende und Gewinnspiel.

## Ergebnis

- Neue Hook: „Wer sagt, dass du das nicht kannst?“.
- Persönliche Geschichte mit konkreten Stationen; Microsoft ist ein Abschnitt der umfassenderen Biografie. Das Alter 20 bleibt im betreffenden Abschnitt, ohne Jahreszahl.
- Drei Lesegründe für eine breite Zielgruppe: neuer Mut, Mitfühlen beim Lesen und ein Geschenk mit Bedeutung.
- Im Einstieg zwei sichtbare Vorteilskarten: 100 % Autoren-Einnahmen mit Kinderschutzbund-Logo und die Gewinnchance auf fünf Tage Dubai für zwei im Wert von 20.000 € plus 100 Wertgutscheine.
- Großer Spendenabschnitt mit unveränderter Zusage, gut sichtbarem Logo und eigenem Bestell-Button. Logo lokal von der offiziellen Website eingebunden; Herkunft unter `public/inbox/README.md` dokumentiert.
- Gewinnspielabschnitt mit Reisebestandteilen, Gutschein-Staffeln, drei Teilnahmeschritten, Registrierungslink und Teilnahmebedingungen. Frist, Gewinne und Status aus der zentralen Konfiguration. Der Kauf allein ist keine Registrierung.
- Mobile und Desktop, GMX-Blau und WEB.DE-Gelb, System-Dark-Mode, Merken, Teilen, Inhaltsnavigation und mobile Bestellleiste.

## Validierung dieser Überarbeitung

- Finaler Produktionsbuild erfolgreich, einschließlich Lint und Typenprüfung.
- 19 Browserprüfungen erfolgreich: 16 Kombinationen aus 320/390/768/1440 Pixeln, beiden Portalvarianten und Light/Dark sowie drei Funktionsprüfungen.
- Beide Vorteilskarten und der erste Bestell-Button sind in allen geprüften Einstiegsansichten vollständig sichtbar, einschließlich 320 × 640 Pixel.
- Kein horizontaler Seitenüberlauf, keine sichtbaren defekten Bilder, keine JavaScript-Laufzeitfehler. Das Logo lädt lokal.
- Merken bleibt nach Reload erhalten und lässt sich zurücknehmen. Teilen bietet bei blockierter Zwischenablage einen markierbaren Link.
- PageView/Reddit PageVisit bei Besuch. Echte Amazon-Klicks erzeugen AddToCart mit korrekter Platzierung: Hero, Sidebar, Spende, Gewinnspiel, Buchdetails, Abschluss und mobile Leiste.
- Die Gewinnspiel-Inhaltsnavigation, Merken und FAQ erzeugen kein Amazon-ATC. Reisebestandteile, Gutschein-Staffeln, Frist sowie Ziele von Registrierung und Teilnahmebedingungen geprüft.
- Auch ohne JavaScript bleiben Nachricht, FAQ und Amazon-Link nutzbar.
- Desktop-Einstieg sowie kleine mobile Ansichten visuell geprüft; vollständige Seitenansicht auf Abschnittsfolge und Überläufe geprüft.
- Werbeendpunkte wurden bei den Browsertests abgefangen. Es wurden keine Test-Conversions an externe Werbeplattformen geschickt.

Die erste 320-Pixel-Prüfung zeigte einen zu weit unten liegenden Bestell-Button. Einstieg und mobile Abstände wurden korrigiert; die vollständige Matrix wurde anschließend erfolgreich ausgeführt. Eine gemessene Steigerung der Conversion-Rate ist damit noch nicht belegt.

## URLs

- Gemeinsamer Kampagnenlink: `https://lizenzzumerfolg.com/buch-inbox?utm_source=uim&utm_medium=inbox_ad&utm_campaign=lizenz_zum_erfolg`
- GMX: `https://lizenzzumerfolg.com/buch-inbox?portal=gmx`
- WEB.DE: `https://lizenzzumerfolg.com/buch-inbox?portal=webde`
- Registrierung nach Bestellung: `https://lizenzzumerfolg.com/gewinn#teilnahme`
- Bedingungen: `https://lizenzzumerfolg.com/gewinn/teilnahmebedingungen`

## Tracking und Veröffentlichung

Die vorhandenen Pixel-/CAPI-Anbindungen bleiben bestehen. Ein UIM-eigenes Conversion-Tag liegt im Projekt weiterhin nicht vor. AddToCart bezeichnet den gewünschten Amazon-Klick-Proxy, keine nachgewiesene Bestellung.

Masterplan und Masterprompt beschreiben die aktuelle Umsetzung. Deploymentstatus und Live-Inhalte werden nach dem Push geprüft und im Abschluss bestätigt. Anzeigenbuchung oder Versand von Inbox-Ads gehören nicht zu diesem Deployment.
