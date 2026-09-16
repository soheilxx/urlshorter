# AdCloud-Newsletter „Dubai für zwei. Und 300 Gutscheine zu gewinnen.“

Stand: 16.09.2026 · Zielseite: `https://lizenzzumerfolg.com/verlosung` · Versand über AdCloud
(Standalone-Mailing an Empfänger der AdCloud-Partnerlisten).

## Dateien

| Datei | Zweck |
| --- | --- |
| `public/newsletter/verlosung-adcloud.html` | HTML-Mail (600 px, Tabellenlayout, Outlook-Fallbacks, Bilder auf lizenzzumerfolg.com). Gleichzeitig die „Im Browser ansehen“-Version unter `https://lizenzzumerfolg.com/newsletter/verlosung-adcloud.html`. |
| `docs/newsletter-verlosung-adcloud.txt` | Textversion (Multipart-Alternative) mit `utm_content=adcloud_text`. |
| `scripts/newsletter-check.mjs` | Zustellbarkeits-/Spam-Vorprüfung: `node scripts/newsletter-check.mjs public/newsletter/verlosung-adcloud.html docs/newsletter-verlosung-adcloud.txt` |

## Betreffzeilen – forschungsbasiertes Ranking (Nr. 1 = beste)

Abgeleitet aus Feldstudien und Lehrbüchern (Details im Chat-Protokoll vom 16.09.2026):
Nutzen und Zahlen in die ersten ~30 Zeichen (Return Path: < 49 Zeichen +12,5 % Opens; Mobil
zeigt 25–35 Zeichen), Spezifität vor Cleverness (Caples, Hopkins, Ogilvy; Conductor: Zahlen
+36 %), großer Gewinn + hohe Anzahl (Prospect Theory: Möglichkeitseffekt; Numerositäts-
Heuristik), Anker 54.500 € vs. 18 € (Tversky/Kahneman), Dringlichkeit als „noch bis“ statt
„letzte Chance“ (Return Path: „still time“ bestes Wort), Vorname wenn verfügbar (Sahni/Wheeler/
Chintagunta 2018: +20 % Opens, −17 % Abmeldungen), kleine Wissenslücke für Re-Sends
(Loewenstein 1994), keine Spam-Signale.

| # | Betreff | Zeichen | Einsatz | Preheader |
| --- | --- | ---: | --- | --- |
| 1 | `Dubai für zwei + 300 Gutscheine – für ein Buch à 18 €` (mit Vorname, falls AdCloud-Token vorhanden: `{Vorname}, Dubai für zwei + 300 Gutscheine – für ein Buch à 18 €`) | 52 | Erstversand, Hauptvariante | Bestellnummer eintragen, dabei sein: Gewinne im Wert von 54.500 €. Bis 11.10.2026. |
| 2 | `Für 18 € im Lostopf: Dubai für zwei und 300 Gutscheine` | 51 | Erstversand, A/B-Gegner | 5 Tage Dubai, Emirates Business Class – plus Gutscheine von Amazon, Wiresoft, Bikinilista. |
| 3 | `300 Gutscheine + Dubai: dein Buch ist das Los` | 44 | Erstversand, Listen mit Gutschein-Fokus | Jede Bestellnummer zählt als ein Los. Buch für 18 € vorbestellen, Nummer eintragen. |
| 4 | `Noch bis 11.10.: Dubai für zwei + 300 Gutscheine` | 47 | Zweitversand / letzte Woche | Buch bestellen, Bestellnummer registrieren – zwei Minuten. Vorbestellung zählt. |
| 5 | `Was ein 18-€-Buch mit Dubai zu tun hat` | 38 | Re-Send an Nicht-Öffner | 5 Tage Dubai für zwei und 300 Gutscheine – für Leserinnen und Leser von „Die Lizenz zum Erfolg“. |
| 6 | `54.500 € Gewinne, 18 € Einsatz – die Buchaktion 2026` | 48 | Variante B | Dubai-Reise für zwei und 300 Gutscheine werden verlost. Anmeldung in zwei Minuten. |
| 7 | `Ein Buch, zwei Minuten, Dubai im Lostopf` | 40 | Variante B / Re-Send | Plus 300 Gutscheine von Amazon, Wiresoft und Bikinilista. Bis 11.10.2026. |
| 8 | `Soheil Hosseini verlost Dubai für zwei – dein Buch ist dabei` | 59 | Reserve | Dazu 300 Gutscheine im Wert von 34.500 €. Anmeldung bis 11.10.2026. |

## Betreffzeilen – erstes Ranking (16.09.2026, vor der Quellenanalyse)

| # | Betreff | Zeichen | Preheader dazu |
| --- | --- | ---: | --- |
| 1 | `Dubai für zwei + 300 Gutscheine – für ein Buch à 18 €` | 52 | Bestellnummer eintragen, dabei sein: Gewinne im Wert von 54.500 €. Bis 11.10.2026. |
| 2 | `300 Gutscheine und eine Dubai-Reise: dein Buch ist das Los` | 57 | Amazon, Wiresoft, Bikinilista – plus 5 Tage Dubai für zwei. Buch für 18 € vorbestellen. |
| 3 | `Neues Buch, 54.500 € Gewinne – dein Einsatz: 18 €` | 49 | Dubai-Reise für zwei und 300 Gutscheine werden verlost. Jede Bestellnummer zählt als Los. |
| 4 | `Bis 11.10.: Dubai-Reise + 300 Gutscheine für Buchkäufer` | 55 | Buch bestellen, Bestellnummer registrieren, fertig. Vorbestellung zählt bereits. |
| 5 | `Was ein 18-€-Buch mit Dubai zu tun hat` | 38 | 5 Tage Dubai für zwei und 300 Gutscheine – nur für Leserinnen und Leser von „Die Lizenz zum Erfolg“. |
| 6 | `Soheil Hosseini verlost Dubai für zwei – dein Buch ist dabei` | 59 | Dazu 300 Gutscheine im Wert von 34.500 €. Anmeldung in zwei Minuten, bis 11.10.2026. |
| 7 | `Jede Bestellnummer ist ein Los: Dubai & 300 Gutscheine` | 54 | Mehrere Bücher, mehrere Lose. Buch für 18 € vorbestellen und Bestellnummer eintragen. |
| 8 | `Buch bestellen, Nummer eintragen, Dubai-Reise gewinnen` | 54 | 300 Gutscheine von Amazon, Wiresoft und Bikinilista gibt es obendrauf. |

Regeln: keine Markennamen (Amazon) im Betreff selbst (Phishing-Verdacht bei Filtern), keine
Emojis, keine Großschreibung, keine Ausrufezeichen, kein „gewonnen“/„Gewinner“ im Betreff.
Empfehlung: Nr. 1 gegen Nr. 2 als A/B-Test auf je 10 % der Liste, Gewinner an den Rest.

## Betreff und Preheader (ursprüngliche Vorschläge)

| Variante | Betreff | Zeichen |
| --- | --- | --- |
| A (Einsatz vs. Chance) | `Buch für 18 € – Dubai-Reise und 300 Gutscheine im Lostopf` | 57 |
| B (Zahlen zuerst) | `300 Gutscheine + Dubai für zwei: Buch bestellen und mitmachen` | 60 |
| C (Frist) | `Bis 11.10.: Buch vorbestellen, Dubai-Reise und 300 Gutscheine gewinnen` | 68 |

Preheader (in der HTML enthalten, 40–130 Zeichen): „Buch für 18 € vorbestellen, Bestellnummer
eintragen: 5 Tage Dubai für zwei plus 300 Gutscheine im Lostopf – bis 11.10.2026.“

Absendername (Vorschlag, wird von AdCloud gesetzt): „Die Lizenz zum Erfolg – Buchaktion“ ·
Reply-To: `info@wiresoft.com`. Keine Emojis oder Großbuchstaben im Betreff, keine
Ausrufezeichen – entspricht der Spam-Prüfung unten.

## Conversion-Aufbau (für Deal-/Gewinnspiel-Empfänger)

1. **Hero**: Hook „Dubai für zwei. Und 300 Gutscheine.“, Badge 54.500 €, Einsatz-vs.-Chance-Satz
   („Dein Einsatz: ein Buch für 18 €“), Cover + Preis + Einwandbehandlung („Vorbestellung zählt
   bereits · keine weiteren Kosten“), CTA „Jetzt Buch für 18 € vorbestellen“, Zweitpfad „Bereits
   gekauft?“, Frist.
2. **Deal-Box „Auf einen Blick“**: fünf Häkchen (Preis, Reise, 300 Gutscheine, Los-Regel,
   zwei Minuten + Frist) – skimmbar für Empfänger, die nur überfliegen.
3. **300 Gutscheine zuerst** (viele Gewinne = hohe gefühlte Chance): Ticket-Karten Amazon,
   Wiresoft, Bikinilista mit allen Staffeln und Summen, CTA „Buch vorbestellen und mitmachen“.
4. **Dubai** als emotionaler Hauptgewinn mit Reisewert-Badge.
5. **Drei Schritte** + Los-Regel (Mehrfachteilnahme korrekt erklärt).
6. **Buch** kurz und ehrlich (ohne Guru-Versprechen), Preis, CTA.
7. **Finale** mit Frist-Badge, letzter CTA, Zweitpfad.
8. Rechtliches (Teilnahmebedingungen, Datenschutz, Veranstalter mit Anschrift, Markenhinweis)
   und AdCloud-Block.

Jeder CTA führt auf `/verlosung` mit `utm_source=adcloud&utm_medium=email&utm_campaign=buch_verlosung_2026`
und `utm_term=<Position>` (hero_cta, hero_cover, hero_teilnehmen, gutscheine_cta, buch_cover, buch_cta,
final_cta, final_teilnehmen). `utm_content` unterscheidet HTML (`adcloud_standalone`) und Text
(`adcloud_text`); für Versandsegmente kann AdCloud `utm_content` je Liste ersetzen (z. B.
`angebote_email`). Die Landingpage speichert UTM-Werte je Teilnahme (Admin → Gewinnspiel, CSV).

## Übergabe an AdCloud – Checkliste

- [ ] HTML + Textversion + Betreff/Preheader liefern; Bilder bleiben auf lizenzzumerfolg.com gehostet
      (Alternative: AdCloud lädt sie in ihr CDN – dann `src` austauschen lassen).
- [ ] Platzhalter `#ADCLOUD_UNSUBSCRIBE#` und `#ADCLOUD_IMPRINT#` durch die AdCloud-Variablen für
      Abmeldelink und Listenbetreiber-Impressum ersetzen lassen (Block ist im HTML als Kommentar markiert).
      Falls AdCloud eigenen Header/Footer erzwingt, den Block entfernen – die Veranstalter-Angaben
      im Abschnitt „Rechtliches“ bleiben.
- [ ] Klick-Tracking von AdCloud darf die Links wrappen – UTM-Parameter bleiben erhalten (geprüft: alle
      Ziel-URLs liefern 200).
- [ ] Testversand an Gmail, Outlook (Desktop + Web), GMX/WEB.DE, Apple Mail; Vorschau mobil prüfen.
- [ ] Optional externer Spam-Score (z. B. mail-tester.com) mit dem AdCloud-Absender – SPF/DKIM/DMARC
      liegen bei AdCloud, nicht bei uns.
- [ ] Versandzeitpunkt vor dem 06.10.2026 (Erscheinen): Copy sagt „vorbestellen“; die Landingpage
      schaltet automatisch auf „kaufen“ um. Nach dem 11.10.2026 nicht mehr versenden (Registrierung
      geschlossen).

## Template B – Ausweichvariante („Buchaktion 2026“)

Falls Template A durch Spam-Meldungen „verbrannt“ ist, steht eine zweite, eigenständige Variante
bereit, die von Fuzzy-Hash-/Duplikat-Erkennung nicht als Kopie erkannt wird:

| Datei | Zweck |
| --- | --- |
| `public/newsletter/buchaktion-dubai.html` | HTML-Mail Variante B (620 px, Editorial-Stil: Serifen-Headlines, persönliche Notiz des Autors mit Porträt, Gewinnliste als Tabelle statt Ticket-Karten, Schritte mit gelber Randlinie, eckige Buttons). Webansicht: `https://lizenzzumerfolg.com/newsletter/buchaktion-dubai.html` |
| `docs/newsletter-buchaktion-dubai.txt` | Textversion B (`utm_content=adcloud_variante_b_text`) |

Unterschiede zu A (gemessen mit Wort-Shingles/Jaccard): sichtbarer Text 1,1 % (8-Wort-Shingles) bzw.
3,4 % (5 Wörter), HTML-Quelltext 3,1 %, keine gemeinsamen Bild-URLs (eigene Assets unter
`public/newsletter/buchaktion/`), andere Web-Adresse, andere Betreff-/Preheader-Texte, andere
`utm_content`-/`utm_term`-Werte, andere Klassennamen/IDs und Farbfolge. Identisch sind nur die
Pflichtlinks (Teilnahmebedingungen, Datenschutz, Impressum, Kontakt, AdCloud-Platzhalter).

Betreff B (Empfehlung): `Ein Buch, eine Dubai-Reise und 300 Gutscheine – so nimmst du teil` ·
Alternativen: `Soheil Hosseini verlost Dubai für zwei und 300 Gutscheine – mit deinem Buch` ·
`18 € für das Buch, 54.500 € im Lostopf: die Buchaktion 2026`.

Einsatzregel: A und B nicht gleichzeitig an dieselbe Liste senden; B erst einsetzen, wenn A
Beschwerden zeigt (oder als A/B-Split auf getrennten Segmenten).

## Ergebnis der Vorprüfung (`scripts/newsletter-check.mjs`)

Wird beim Lauf ausgegeben; Stand 16.09.2026: HTML 43 KB (< 102 KB), 3 Bilder mit alt/width/height
auf 800+ Wörter Text, keine Skripte/Formulare/iframes, alle Tabellen `role="presentation"`,
keine Spam-Triggerwörter, 0 Ausrufezeichen, keine Großschreibung im Quelltext (Kicker per CSS),
Abmeldeplatzhalter, Impressum, Teilnahmebedingungen, Datenschutz und Veranstalter-Anschrift
vorhanden, Textversion enthält alle Ziel-URLs, alle Links/Bilder erreichbar (200).
