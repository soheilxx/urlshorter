# AdCloud-Newsletter „Dubai für zwei. Und 300 Gutscheine zu gewinnen.“

Stand: 16.09.2026 · Zielseite: `https://lizenzzumerfolg.com/verlosung` · Versand über AdCloud
(Standalone-Mailing an Empfänger der AdCloud-Partnerlisten).

## Dateien

| Datei | Zweck |
| --- | --- |
| `public/newsletter/verlosung-adcloud.html` | HTML-Mail (600 px, Tabellenlayout, Outlook-Fallbacks, Bilder auf lizenzzumerfolg.com). Gleichzeitig die „Im Browser ansehen“-Version unter `https://lizenzzumerfolg.com/newsletter/verlosung-adcloud.html`. |
| `docs/newsletter-verlosung-adcloud.txt` | Textversion (Multipart-Alternative) mit `utm_content=adcloud_text`. |
| `scripts/newsletter-check.mjs` | Zustellbarkeits-/Spam-Vorprüfung: `node scripts/newsletter-check.mjs public/newsletter/verlosung-adcloud.html docs/newsletter-verlosung-adcloud.txt` |

## Betreff und Preheader (Empfehlung, A/B-fähig)

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

## Ergebnis der Vorprüfung (`scripts/newsletter-check.mjs`)

Wird beim Lauf ausgegeben; Stand 16.09.2026: HTML 43 KB (< 102 KB), 3 Bilder mit alt/width/height
auf 800+ Wörter Text, keine Skripte/Formulare/iframes, alle Tabellen `role="presentation"`,
keine Spam-Triggerwörter, 0 Ausrufezeichen, keine Großschreibung im Quelltext (Kicker per CSS),
Abmeldeplatzhalter, Impressum, Teilnahmebedingungen, Datenschutz und Veranstalter-Anschrift
vorhanden, Textversion enthält alle Ziel-URLs, alle Links/Bilder erreichbar (200).
