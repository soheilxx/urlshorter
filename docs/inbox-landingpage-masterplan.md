# Masterplan: Die Lizenz zum Erfolg – Inbox Ads

Stand: 6. September 2026. Zielroute: `/buch-inbox`. Auftrag: eine zusätzliche Landingpage für Klicks aus GMX-/WEB.DE-Inbox-Ads, anschließend Umsetzung und Veröffentlichung im vorhandenen Next.js-Projekt.

## 1. Ziel und Erkenntnisse

Ein Besucher kommt aus seinem Postfach und soll sofort verstehen: Wer spricht mich an, warum lohnt sich diese Geschichte für mich, was bekomme ich und wo bestelle ich? Hauptziel ist ein bewusster Klick zum Buch auf Amazon. Das vertraute Muster einer geöffneten Nachricht verbindet Anzeige und Landingpage.

Die Recherche liefert eine Grundlage für Gestaltung und Ansprache, keinen Beweis für die Kaufwirkung einer bestimmten Buchgeschichte. Die konkrete Wirkung muss anhand der Kampagnenergebnisse geprüft werden. Es werden keine pauschalen Alters-, Bildungs- oder Persönlichkeitsannahmen über GMX-/WEB.DE-Nutzer getroffen.

### Recherche und Ableitungen

- [UIM Newsletter-DACH-Studie 2026](https://www.united-internet-media.de/de/research/online-studien/user-insights/newsletter-dach-studie-2026/): Befragung von 6.000 Onlinern, November 2025. Wenig Text und wiedererkennbares Design sind wichtige Gestaltungspräferenzen; vertrauenswürdig wirkende Absenderinformationen sind wesentlich. Ableitung: kurze Absätze, sichtbarer Autor, direkt erkennbare Buchvorstellung. Die Newsletter-Ergebnisse sind eine Orientierung für E-Mail-Nutzung, keine direkte Conversion-Prognose für diese Landingpage.
- [UIM Inbox-Ad-Studie 2017](https://www.united-internet-media.de/de/research/online-studien/user-insights/werbewahrnehmung-der-inbox-ad-2017/): kleiner Smartphone-Labortest mit 21 Personen. Betreff und native Einbindung erhielten Aufmerksamkeit. Ableitung: ein kurzer, konkreter Betreff mit Alter und Microsoft; Layout einer geöffneten Nachricht. Wegen Alter und Stichprobe nur ergänzende Evidenz.
- [UIM Inbox Ad Clickout](https://www.united-internet-media.de/de/produkteundloesungen/native/inbox-ad/inbox-ad-clickout/): der Anzeigenklick führt direkt zur Landingpage, auf Desktop und Mobile. Deshalb keine zusätzliche Zwischenseite vor der Buchgeschichte.
- [GMX-Ordnernavigation](https://www.gmx.net/blog/posts/neue-ordner-navigation/623/) und [WEB.DE-Ansicht](https://hilfe.web.de/email/empfangen-und-lesen/ansicht-sortierung.html): Ordner links, Lesebereich, Absender/Betreff und Favoriten-Stern sind erkennbare Bedienmuster. Diese Muster werden mit der eigenen Buchmarke verwendet.
- [UIM Clickout-Spezifikation, April 2026](https://www.united-internet-media.de/fileadmin/uim/media/home/downloadcenter/Spezifikationen/Native_Advertising/UIM_Spezifikationen_Inbox_Ad_Clickout.pdf): Absender maximal 20 Zeichen, empfohlener Betreff maximal 30 Zeichen, App-Preheader maximal 50 Zeichen. Die Portale werden laut Spezifikation nicht separat getrackt. Ein gemeinsamer Ziel-Link ist deshalb der Standard; Varianten sind zusätzlich über explizite Parameter oder einen erkennbaren Referrer erreichbar. Anzeigenbuchung und deren Freigabe sind ein eigener Schritt und werden durch das Website-Deployment nicht ausgelöst.

## 2. Storytelling und Lesernutzen

Ansprache: warm, direkt, erwachsen, respektvoll. Eine persönliche Buchvorstellung aus Soheils Perspektive, geschrieben im Auftrag des Autors. Kurze Nachricht statt langer Verkaufsrede. Der Text ist neue Werbecopy, kein als Buchauszug ausgegebener Text.

Hook: **„Mit 20 stand ich Microsoft gegenüber.“**

Der Altersunterschied und das ungleiche Gegenüber wecken Neugier. Anschließend wird sofort der Bogen zum ganzen Buch geschlagen: eigene Entscheidungen, Unternehmensaufbau und Selbstbestimmung. Die Herkunft bekommt einen kurzen Platz in der Autorenvorstellung, aber keinen der drei Kaufgründe.

Die drei Kaufgründe greifen Situationen des Lesers auf:

1. **Du willst den nächsten Schritt wagen.** Ein eigenes Projekt, berufliche Veränderung oder Selbstständigkeit; die Biografie bietet persönliche Einblicke und Impulse für die eigenen Vorhaben.
2. **Du willst dir treu bleiben. Auch bei Gegenwind.** Identifikation mit Entscheidungen unter Widerstand und der Frage, wofür man einsteht.
3. **Du willst Erfolg nach deinen Maßstäben.** Reflexion über Freiheit, Anerkennung, eigene Prioritäten; auch für Menschen interessant, die einfach gerne Biografien lesen.

Möglicher psychologischer Nutzen: erkennbare Alltagssituationen erleichtern den persönlichen Bezug; ein konkret benannter Autor macht die Nachricht greifbar; kurze Abschnitte verringern Leseaufwand; Merken ermöglicht eine freiwillige spätere Rückkehr. Diese Gestaltungshypothesen werden nicht als garantierte Wirkung dargestellt.

Verbindliche Fakten und Copy-Vorgaben:

- Soheil Hosseini ist bei Beginn der ersten Microsoft-Auseinandersetzung 20. Keine Jahreszahl 2011.
- Kein erfundener Prozessausgang, kein Microsoft-Zitat, keine erfundene Szene und keine konkreten Buchkapitel ohne Vorlage.
- Titel, Untertitel, Autor, Verlag, ISBN, Preis, Erscheinung und Spendenhinweis aus `src/lib/buch-config.ts`.
- Verlag: Deutscher Wirtschaftsbuch Verlag. Preis: 18 €. Taschenbuch, Erscheinung 6. Oktober 2026.
- Spendenhinweis exakt: **„Die gesamten Einnahmen des Autors aus diesem Buch fließen an den Kinderschutzbund.“** Keine Aussage über Einnahmen anderer Beteiligter.
- Bestell-CTA: **„Bei Amazon bestellen“**. Keine Formulierung „vorbestellen“ im sichtbaren Text.

## 3. Oberfläche und Seitenaufbau

Eigene Marke: **Lesepost · Die Lizenz zum Erfolg**. Deutlich sichtbare Kennzeichnung „Buchvorstellung · Anzeige“, Absender Soheil Hosseini mit vorhandenem Autorenfoto. Die Oberfläche übernimmt Postfach-Muster; sie zeigt die Buchseite des Autors und keine fremde Kontositzung. Einträge führen zu tatsächlich vorhandenen Inhalten, der Stern speichert die eigene Auswahl lokal. Keine Anmeldung, erfundenen Absender oder angeblich empfangenen Privatnachrichten.

Desktop: farbiger Kopf, links eine schmale Ordner-/Inhaltsnavigation, geöffnete Nachricht mit Betreff und Absender, rechts eine ruhige Buchkarte. Lesetext etwa 600–660 Pixel breit; Systemschrift Inter, klare Konturen, sparsame Akzente, keine dekorative Animationswand.

Mobil: kompakter Kopf, einspaltiger Lesebereich, Merken/Teilen in einer Zeile, kompakte Buchkarte direkt nach dem Einstieg. Der erste Bestell-Button muss auch auf kleinen Handys früh erreichbar sein. Ein unterer Bestellstreifen erscheint erst, wenn der erste CTA aus dem Blick gescrollt ist; am Footer wird er ausgeblendet. Safe-Area-Abstände berücksichtigen.

Reihenfolge:

1. Mail-Kopf mit Absender, Werbekennzeichnung, kurzer Hook.
2. Kurzer persönlicher Einstieg, Buchcover, Titel, Preis und erster Amazon-CTA.
3. Spendenhinweis nahe dem ersten CTA.
4. Persönliche Nachricht: vom ungleichen Konflikt zum gesamten Lebensweg.
5. Drei klar auf den Leser bezogene Kaufgründe.
6. Buchdetails und Autor, unterschriebene Einladung zum Lesen.
7. Vier FAQ: Inhalt, Zielgruppe/Genre, Autoren-Einnahmen, Bestellung/Lieferung.
8. Abschließender CTA, Impressum, Datenschutz.

Farbvarianten: GMX-orientiert Blau, WEB.DE-orientiert Gelb mit dunkler Schrift; gemeinsame Struktur. System-Dark-Mode für beide über lokale CSS-Variablen, unabhängig vom Admin-Theme-Cookie. Ohne erkennbare Quelle: neutrale blaue Lesepost. Parameter dürfen nur eine feste Farbvariante wählen, niemals beliebigen Inhalt oder HTML einspeisen.

## 4. Routen, Tracking und Verknüpfung

- Gemeinsame Route und Canonical: `https://lizenzzumerfolg.com/buch-inbox`.
- Gemeinsamer Kampagnenlink: `/buch-inbox?utm_source=uim&utm_medium=inbox_ad&utm_campaign=lizenz_zum_erfolg`.
- Optionale fest gewählte Varianten: `?portal=gmx` und `?portal=webde`.
- Auswahl: gültiger `portal`-Parameter, dann `utm_source`, dann exakt passender GMX-/WEB.DE-Referrer-Host, sonst Standard. Die Referer-Erkennung ist ein Komfort-Fallback und keine verlässliche Attribution.
- Bestehende Buch-Conversion-Komponenten wiederverwenden. Signierte Pfadfreigaben um `/buch-inbox` erweitern. Vorhandene Pixel-/CAPI-Konfiguration bleibt serverseitig; keine Zugangsdaten in Dateien schreiben.
- Sichtbarer Besuch: PageView bzw. Reddit PageVisit. Amazon-Klick: AddToCart als vom Auftraggeber gewählter Kauf-Proxy. Merken, Teilen und Inhaltsnavigation lösen keinen ATC aus. Deduplizierung und Same-Origin-Prüfung beibehalten.
- `data-gw-event="buch_amazon_klick"`, eindeutige `data-cta-id`, vorhandene UTM-Erfassung. Consent-Betriebsmodus entsprechend der bestehenden Buch-Kampagnenseiten und der bereits erteilten Betreiberanweisung.
- Die vorhandenen Meta-/TikTok-/Reddit-/LinkedIn-/Google-Anbindungen ersetzen kein UIM-eigenes Conversion-Tag. Im Projekt ist kein solches Tag konfiguriert; ohne gelieferte UIM-ID wird keine UIM-Plattformmeldung behauptet. Die Buch-Events und Kampagnenzuordnung sind unabhängig davon prüfbar.

## 5. Umsetzung

Neue Komponenten unter `src/components/inbox-book/`, eigene CSS-Module, Route `src/app/buch-inbox/page.tsx`, kleine öffentliche Konfiguration für Varianten/FAQ. Vorhandene Cover-/Autorenbilder verwenden. Keine Änderungen an Inhalt oder Aktivitätsanzeige der Reddit-Seite.

Interaktionen: Merken mit lokalem Speicher und `aria-pressed`, Teilen über Web Share bzw. Clipboard/markierbaren Link, Inhaltslinks, native FAQ, mobile Bestellleiste. Kerninhalt und Amazon-Links funktionieren ohne JavaScript. Keine unnützen Suchfelder, Löschbuttons oder Postfach-Funktionen ohne Bedeutung für diese Seite.

## 6. Abnahme

Produktionsbuild mit Typen/Lint; gezielte Unit-Tests für Variantenwahl und signierte Trackingroute; Browserprüfung von 320, 390, 768 und 1440 Pixel, beide Farbrichtungen und Systemthemen. Prüfen: keine Überläufe, sichtbare Hook/früher CTA, 44-Pixel-Bedienflächen, Tab-/Enter-Bedienung, Merken nach Reload, Sharing-Fallback, FAQ, Sticky-CTA und Bildladung. Werbeendpunkte in lokalen Browsertests abfangen; keine Test-Conversions an echte Werbeplattformen senden. Nach Deployment HTTP, neue Inhalte, beide Varianten und Deploymentstatus prüfen.

## 7. Kampagnenstart und Optimierung

Ads-Starttexte innerhalb der konservativen UIM-Limits vorbereiten: Absender `Soheil Hosseini`; Betreff `Mit 20 gegen Microsoft`; Preheader `Eine Lebensgeschichte. Impulse für deinen Weg.` Die Landingpage führt denselben Gedanken in der Ich-Perspektive fort. Die Buchung wird nicht automatisch erstellt.

Nach ausreichendem Traffic Klickrate der Anzeige und Amazon-CTA-Rate der Landingpage getrennt betrachten. CTA-Klicks sind kein Nachweis einer Amazon-Bestellung. Als späteren Betreff-Test eher Neugier gegen persönlichen Nutzen vergleichen; keine Siegerquote vorab behaupten. Studien und Spezifikationen sind im Plan dokumentiert, nicht als wissenschaftliche Werbebehauptungen in die Landingpage eingebaut.
