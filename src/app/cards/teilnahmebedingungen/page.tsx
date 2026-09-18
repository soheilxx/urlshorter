import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BUCH_TITEL } from "@/lib/buch-config";
import {
  CARDMARKET_VOUCHER_HELP_URL,
  CARDS_ANNOUNCEMENT_LABEL,
  CARDS_CARDMARKET_COUNT,
  CARDS_CARDMARKET_TOTAL_LABEL,
  CARDS_CARDMARKET_VALUE_LABEL,
  CARDS_ENTRY_DEADLINE_LABEL,
  CARDS_ENTRY_PATH,
  CARDS_MAIN_PRIZE,
  CARDS_PRIZE_COUNT,
  CARDS_PRIZES,
  CARDS_TERMS_VERSION,
  cardsPrizeFullLabel,
} from "@/lib/cards-giveaway-config";
import {
  CONTACT_EMAIL,
  ELIGIBLE_COUNTRIES_LABEL,
  MIN_AGE,
  ORGANIZER_ADDRESS,
  ORGANIZER_NAME,
} from "@/lib/gewinnspiel-config";

export const metadata: Metadata = {
  title: { absolute: `Teilnahmebedingungen Cards-Gewinnspiel | ${BUCH_TITEL}` },
  robots: { index: false, follow: false },
};

/**
 * Eigene Teilnahmebedingungen des Cards-Gewinnspiels (Kampagne cards_2026).
 * Grundlage sind die allgemeinen Bedingungen des Buch-Gewinnspielsystems
 * (Veranstalter, Teilnahmeberechtigung, Prüfung, Gewinne pro Person,
 * Benachrichtigung); alle kampagnenspezifischen Angaben stammen aus
 * src/lib/cards-giveaway-config.ts. Bei Änderungen dort CARDS_TERMS_VERSION
 * anheben – gespeicherte Versionen älterer Teilnahmen bleiben unverändert.
 */
export default function CardsTeilnahmebedingungenPage() {
  return (
    <div className="cards-theme min-h-screen">
      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 lg:py-16">
        <Link
          href={CARDS_ENTRY_PATH}
          className="inline-flex min-h-[44px] items-center gap-2 text-sm text-[var(--cd-ink-mute)] hover:text-[var(--cd-ink)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Zurück zum Cards-Gewinnspiel
        </Link>

        <h1 className="cd-display mt-6 text-3xl font-semibold tracking-tight text-[var(--cd-ink)]">
          Teilnahmebedingungen Cards-Gewinnspiel
        </h1>
        <p className="mt-2 text-sm text-[var(--cd-ink-mute)]">
          TCG-Gewinnspiel zum Buch „{BUCH_TITEL}“ (lizenzzumerfolg.com/cards) · Version{" "}
          {CARDS_TERMS_VERSION}
        </p>

        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-[var(--cd-ink-soft)]">
          <section>
            <h2 className="text-lg font-semibold text-[var(--cd-ink)]">
              1. Veranstalter und Aktion
            </h2>
            <p className="mt-2">
              Veranstalter des Gewinnspiels ist die {ORGANIZER_NAME}, {ORGANIZER_ADDRESS}
              („Veranstalter“). Kontakt: {CONTACT_EMAIL}. Das Cards-Gewinnspiel ist eine
              eigenständige Aktion mit eigenem Lostopf, eigenen Gewinnen und eigener Teilnahmefrist.
              Es ist nicht Teil der Dubai-Verlosung (lizenzzumerfolg.com/gewinn bzw. /verlosung);
              Teilnahmen, Lose und Gewinne beider Aktionen werden getrennt geführt.
            </p>
            <p className="mt-2">
              ONE PIECE CARD GAME, Dragon Ball Super Card Game Fusion World, Yu-Gi-Oh! TRADING CARD
              GAME, Cardmarket und Amazon sind Marken bzw. Angebote der jeweiligen Inhaber; die
              Nennung bezeichnet die verlosten Produkte bzw. Gutscheine. Eine Sponsoring- oder
              Kooperationspartnerschaft wird damit nicht behauptet. Der Kinderschutzbund als
              Spendenempfänger der Autoreneinnahmen ist an dem Gewinnspiel nicht beteiligt.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--cd-ink)]">2. Gewinne</h2>
            <p className="mt-2">
              Verlost werden insgesamt {CARDS_PRIZE_COUNT} einzelne Gewinne in vier Kategorien:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              {CARDS_PRIZES.map((prize) => (
                <li key={prize.id}>
                  <strong className="font-semibold text-[var(--cd-ink)]">
                    {cardsPrizeFullLabel(prize)}
                  </strong>
                  {prize.main ? " – Hauptgewinn" : ""}
                  {prize.contents ? ` (je Gewinn: ${prize.contents})` : ""}
                  {prize.id === "cardmarket_100"
                    ? ` (${CARDS_CARDMARKET_COUNT} Gutscheine über jeweils ${CARDS_CARDMARKET_VALUE_LABEL}, zusammen ${CARDS_CARDMARKET_TOTAL_LABEL})`
                    : ""}
                </li>
              ))}
            </ul>
            <p className="mt-2">
              Der Hauptgewinn ist ein ganzes {CARDS_MAIN_PRIZE.unit} mit 12 Booster Boxes; es
              handelt sich weder um eine einzelne Booster Box noch um einzelne Booster-Packs. Die
              Magnificent-Monsters-Gewinne sind jeweils ein ganzes Case mit 12 Boxen der EU-Version;
              die Dragon-Ball-Gewinne sind jeweils ein Display (Booster Box mit 20 Packs), kein
              Case. Die Sachgewinne werden als versiegeltes Produkt verlost; einzelne Karten, ein
              bestimmter Inhalt oder ein bestimmter Wert werden nicht zugesagt. Die
              Magnificent-Monsters-Cases sind die EU Version in englischer Sprache; auch die
              abgebildeten OP-17- und Story-Booster-01-Produkte sind die englischen Ausgaben. Die
              Abbildungen auf der Aktionsseite zeigen jeweils eine Box bzw. ein Display des
              Produkts.
            </p>
            <p className="mt-2">
              Für die Cardmarket-Wertgutscheine gelten die offiziellen Einlösebedingungen von
              Cardmarket (
              <a
                href={CARDMARKET_VOUCHER_HELP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-[var(--cd-gold)]/50 underline-offset-2 hover:text-[var(--cd-gold)]"
              >
                Cardmarket-Hilfe: Gutscheine
              </a>
              ): Der Gutschein wird im Cardmarket-Konto eingelöst, das Guthaben ist ausschließlich
              für Einkäufe auf Cardmarket nutzbar und nicht auszahlbar. Eine Barauszahlung oder ein
              Umtausch der Gewinne ist ausgeschlossen. Pro Person wird innerhalb des
              Cards-Gewinnspiels höchstens ein Gewinn vergeben.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--cd-ink)]">
              3. Teilnahme und Teilnahmezeitraum
            </h2>
            <p className="mt-2">
              Die Teilnahme erfolgt durch die Bestellung des Buches „{BUCH_TITEL}“ bei Amazon
              (Bestell-Link auf der Aktionsseite) und die Registrierung der Bestell- bzw.
              Auftragsnummer zusammen mit den Kontaktdaten auf lizenzzumerfolg.com/cards.
              Bestellungen bei anderen Buchhändlern können mit ihrer Bestellnummer ebenfalls
              registriert werden. Der Kauf allein ist keine Teilnahme; die Teilnahme erfolgt nicht
              automatisch.
            </p>
            <p className="mt-2">
              Jede gültige, einzeln registrierte Bestellnummer zählt im Cards-Gewinnspiel als ein
              Los; mit mehreren Bestellungen mit jeweils eigener Bestellnummer sind entsprechend
              mehrere Lose möglich. Dieselbe Bestellnummer nimmt im Cards-Gewinnspiel insgesamt nur
              einmal teil; ein wiederholtes Absenden derselben Nummer erzeugt kein zusätzliches Los.
              Mehrere Exemplare innerhalb einer Bestellnummer ergeben kein zusätzliches Los.
            </p>
            <p className="mt-2">
              Eine bereits für die Dubai-Verlosung registrierte Bestellnummer kann für das
              Cards-Gewinnspiel einmal separat registriert werden; dafür ist eine eigene Anmeldung
              auf lizenzzumerfolg.com/cards erforderlich. Bestehende Anmeldungen zur Dubai-Verlosung
              werden nicht automatisch übernommen, und Cards-Anmeldungen nehmen nicht an der
              Dubai-Verlosung teil.
            </p>
            <p className="mt-2">
              Die Teilnahme ist ab Veröffentlichung dieser Bedingungen bis zum Teilnahmeschluss am{" "}
              {CARDS_ENTRY_DEADLINE_LABEL} möglich (Zeitzone Europe/Berlin; die volle Schlussminute
              zählt mit). Maßgeblich ist der serverseitig festgestellte Eingang einer vollständigen,
              gültigen Registrierung; später eingehende Registrierungen nehmen nicht mehr teil. Die
              Bestellung des Buches erfolgt zum regulären Preis; über die Registrierung hinaus
              entstehen keine Teilnahmekosten. Die Bestellbestätigung ist bis zum Abschluss der
              Verlosung aufzubewahren und auf Anforderung des Veranstalters als Bestellnachweis
              vorzulegen. Herkunftskennungen aus Werbelinks (z. B. UTM-Parameter) dienen
              ausschließlich der Auswertung der Werbemaßnahmen und haben keinen Einfluss auf die
              Gewinnberechtigung.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--cd-ink)]">4. Teilnahmeberechtigung</h2>
            <p className="mt-2">
              Teilnahmeberechtigt sind natürliche Personen ab {MIN_AGE} Jahren mit Wohnsitz in{" "}
              {ELIGIBLE_COUNTRIES_LABEL}. Mitarbeitende des Veranstalters sowie deren Angehörige
              sind von der Teilnahme ausgeschlossen. Die Teilnahme über automatisierte Verfahren,
              Gewinnspiel-Dienste oder mit falschen Angaben ist unzulässig und führt ebenso wie
              Manipulationsversuche zum Ausschluss.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--cd-ink)]">
              5. Gewinnermittlung und Benachrichtigung
            </h2>
            <p className="mt-2">
              Die Gewinnerinnen und Gewinner werden nach Teilnahmeschluss per Zufallsziehung unter
              allen gültigen Teilnahmen des Cards-Gewinnspiels ermittelt – zunächst der Hauptgewinn,
              anschließend die weiteren Gewinne in der Reihenfolge ihrer Auflistung in Ziffer 2.
              Eine gezogene Teilnahme sowie weitere Teilnahmen derselben Person werden bei den
              folgenden Ziehungen des Cards-Gewinnspiels nicht mehr berücksichtigt. Teilnahmen oder
              Gewinne bei der Dubai-Verlosung bleiben für das Cards-Gewinnspiel unberücksichtigt.
            </p>
            <p className="mt-2">
              Die Gewinnerbekanntgabe erfolgt am {CARDS_ANNOUNCEMENT_LABEL}; die Benachrichtigung
              erfolgt über die angegebene E-Mail-Adresse und gegebenenfalls telefonisch. Meldet sich
              eine Gewinnerin oder ein Gewinner nicht innerhalb von 14 Tagen nach der
              Benachrichtigung oder kann kein gültiger Bestellnachweis erbracht werden, kann
              ersatzweise neu gezogen werden.
            </p>
            <p className="mt-2">
              Eine öffentliche Bekanntgabe erfolgt ohne gesonderte Einwilligung höchstens in
              datensparsamer Form (z. B. Vorname und abgekürzter Nachname oder Teilnahme-Referenz).
              Eine weitergehende Veröffentlichung erfolgt nur nach ausdrücklicher Einwilligung.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--cd-ink)]">6. Gewinnabwicklung</h2>
            <p className="mt-2">
              Die Gewinne sind nicht übertragbar. Sachgewinne werden nach Bestätigung der
              Gewinnberechtigung (Rückmeldung und auf Anforderung Bestellnachweis) an die bei der
              Registrierung angegebene Anschrift in {ELIGIBLE_COUNTRIES_LABEL} versendet; die
              Cardmarket-Wertgutscheine werden per E-Mail an die bei der Registrierung angegebene
              Adresse übermittelt. Kann ein Gewinn aus Gründen, die der Veranstalter nicht zu
              vertreten hat, nicht erbracht werden, erhält die jeweilige Gewinnerin bzw. der
              jeweilige Gewinner eine gleichwertige Ersatzleistung.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--cd-ink)]">
              7. Vorzeitige Beendigung und Änderungen
            </h2>
            <p className="mt-2">
              Der Veranstalter kann das Gewinnspiel aus wichtigem Grund (insbesondere bei
              technischen Störungen, Manipulation oder aus rechtlichen Gründen) anpassen,
              unterbrechen oder vorzeitig beenden. Bereits erlangte Gewinnansprüche bleiben davon
              unberührt.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--cd-ink)]">8. Datenschutz</h2>
            <p className="mt-2">
              Die im Formular erhobenen Daten werden ausschließlich zur Durchführung und Abwicklung
              des Cards-Gewinnspiels verarbeitet (Duplikatprüfung innerhalb der Aktion,
              Gewinnermittlung, Benachrichtigung, Gewinnabwicklung) und nicht zu Werbezwecken an
              Dritte übermittelt. Bestellnummern werden zur Duplikaterkennung als nicht
              rückrechenbarer Hash und im Übrigen verschlüsselt gespeichert. Nach Abschluss des
              Gewinnspiels werden die Daten gelöscht, soweit keine gesetzlichen
              Aufbewahrungspflichten bestehen. Teilnehmende können Auskunft, Berichtigung oder
              Löschung ihrer Daten jederzeit über {CONTACT_EMAIL} verlangen. Ergänzend gilt die auf
              der Aktionsseite verlinkte Datenschutzerklärung.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--cd-ink)]">9. Schlussbestimmungen</h2>
            <p className="mt-2">
              Es gilt deutsches Recht; zwingende verbraucherschützende Bestimmungen des Staates, in
              dem Teilnehmende ihren gewöhnlichen Aufenthalt haben, bleiben unberührt. Der Rechtsweg
              ist hinsichtlich der Ziehung ausgeschlossen. Sollten einzelne Bestimmungen dieser
              Teilnahmebedingungen unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen
              unberührt.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
