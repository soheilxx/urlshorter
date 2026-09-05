import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ANNOUNCEMENT_DATETIME_LABEL,
  CONTACT_EMAIL,
  ELIGIBLE_COUNTRIES_LABEL,
  ENTRY_DEADLINE_LABEL,
  MIN_AGE,
  ORGANIZER_ADDRESS,
  ORGANIZER_NAME,
  PRIZE_VALUE_LABEL,
  SECONDARY_PRIZE_EXAMPLES_LABEL,
  SECONDARY_PRIZE_SHOP_NAME,
  SECONDARY_PRIZE_SHOP_URL,
  SECONDARY_PRIZES,
  SECONDARY_PRIZES_COUNT,
  SECONDARY_PRIZES_TOTAL_LABEL,
  TERMS_VERSION,
} from "@/lib/gewinnspiel-config";

export const metadata: Metadata = {
  title: { absolute: "Teilnahmebedingungen | Die Lizenz zum Erfolg" },
  robots: { index: false, follow: false },
};

/**
 * Teilnahmebedingungen des Dubai-Gewinnspiels.
 * Inhaltliche Eckwerte werden zentral in src/lib/gewinnspiel-config.ts
 * gepflegt; bei Änderungen dort die TERMS_VERSION anheben (neue Teilnahmen
 * speichern die jeweils bestätigte Version).
 */
export default function TeilnahmebedingungenPage() {
  return (
    <div className="gewinn-theme min-h-screen">
      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 lg:py-16">
        <Link
          href="/gewinn"
          className="inline-flex min-h-[44px] items-center gap-2 text-sm text-[var(--gw-ink-mute)] hover:text-[var(--gw-ink)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Zurück zum Gewinnspiel
        </Link>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-[var(--gw-ink)]">
          Teilnahmebedingungen
        </h1>
        <p className="mt-2 text-sm text-[var(--gw-ink-mute)]">
          Gewinnspiel „Dubai-Reise“ zum Buch „Die Lizenz zum Erfolg“ · Version {TERMS_VERSION}
        </p>

        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-[var(--gw-ink-soft)]">
          <section>
            <h2 className="text-lg font-semibold text-[var(--gw-ink)]">1. Veranstalter</h2>
            <p className="mt-2">
              Veranstalter des Gewinnspiels ist die {ORGANIZER_NAME}, {ORGANIZER_ADDRESS}
              („Veranstalter“). Kontakt: {CONTACT_EMAIL}.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--gw-ink)]">2. Gewinne</h2>
            <p className="mt-2">
              Hauptgewinn ist eine 5-tägige Dubai-Reise für die Gewinnerin oder den Gewinner und
              eine frei wählbare Begleitperson im Gesamtwert von {PRIZE_VALUE_LABEL}. Der
              Hauptgewinn umfasst:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>Hin- und Rückflug mit Emirates in der Business Class für zwei Personen</li>
              <li>Aufenthalt in einem exklusiven 5-Sterne-Designerhotel in Dubai</li>
              <li>Unterbringung in einer Suite</li>
              <li>Dinner für zwei Personen in einem der angesagtesten Restaurants Dubais</li>
              <li>
                auf Wunsch ein persönliches Meet &amp; Greet mit dem Autor Soheil Hosseini
              </li>
            </ul>
            <p className="mt-2">
              Reisezeitraum und konkrete Termine werden nach der Gewinnbenachrichtigung gemeinsam
              mit der Gewinnerin bzw. dem Gewinner abgestimmt; Flug- und Hotelverfügbarkeiten
              bleiben vorbehalten. Kosten, die nicht ausdrücklich als Bestandteil des Gewinns
              genannt sind (z. B. An- und Abreise zum Abflughafen, weitere Verpflegung, Visa- und
              Reisedokumente, Reiseversicherungen), tragen die Reisenden selbst. Für die Reise sind
              gültige Reisedokumente erforderlich.
            </p>
            <p className="mt-2">
              Daneben werden {SECONDARY_PRIZES_COUNT} Wertgutscheine für den{" "}
              {SECONDARY_PRIZE_SHOP_NAME} ({SECONDARY_PRIZE_SHOP_URL}) im Gesamtwert von{" "}
              {SECONDARY_PRIZES_TOTAL_LABEL} verlost:{" "}
              {SECONDARY_PRIZES.map((p) => `${p.count} × ${p.valueLabel}`).join(", ")}. Die
              Wertgutscheine sind auf das gesamte Sortiment des Shops einlösbar (
              {SECONDARY_PRIZE_EXAMPLES_LABEL}). Gültigkeitsdauer und weitere Einlösebedingungen
              werden zusammen mit dem Gutschein mitgeteilt; eine Barauszahlung ist ausgeschlossen.
              Pro Person wird höchstens ein Gewinn vergeben.
            </p>
            <p className="mt-2">
              Diese Fassung (Version {TERMS_VERSION}) gilt für alle gültigen Teilnahmen – auch für
              bereits zuvor registrierte Bestellungen. Gegenüber der Vorfassung wurden die
              Teilnahmefrist verlängert, die Gewinnerbekanntgabe verschoben und die Wertgutscheine
              als weitere Gewinne ergänzt.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--gw-ink)]">
              3. Teilnahme und Teilnahmezeitraum
            </h2>
            <p className="mt-2">
              Die Teilnahme erfolgt durch die Bestellung des Buches „Die Lizenz zum Erfolg“ bei einem
              Händler und die Registrierung der Bestell- bzw. Auftragsnummer zusammen mit den
              Kontaktdaten auf lizenzzumerfolg.com/gewinn. Jede Bestellnummer kann nur einmal
              registriert werden; mit mehreren Bestellungen sind entsprechend mehrere Teilnahmen
              möglich. Die Bestellbestätigung ist bis zum Abschluss der Verlosung aufzubewahren und
              auf Anforderung des Veranstalters als Bestellnachweis vorzulegen.
            </p>
            <p className="mt-2">
              Die Teilnahme ist ab Veröffentlichung dieser Bedingungen bis zum Registrierungsschluss
              am {ENTRY_DEADLINE_LABEL} (MESZ) möglich; später eingehende Registrierungen nehmen
              nicht mehr teil. Die Bestellung des Buches erfolgt
              zum regulären Preis; über die Registrierung hinaus entstehen keine Teilnahmekosten.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--gw-ink)]">4. Teilnahmeberechtigung</h2>
            <p className="mt-2">
              Teilnahmeberechtigt sind natürliche Personen ab {MIN_AGE} Jahren mit Wohnsitz in{" "}
              {ELIGIBLE_COUNTRIES_LABEL}. Mitarbeitende des Veranstalters sowie deren Angehörige
              sind von der Teilnahme ausgeschlossen. Die Teilnahme über automatisierte Verfahren,
              Gewinnspiel-Dienste oder mit falschen Angaben ist unzulässig und führt ebenso wie
              Manipulationsversuche zum Ausschluss.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--gw-ink)]">
              5. Gewinnermittlung und Benachrichtigung
            </h2>
            <p className="mt-2">
              Die Gewinnerinnen und Gewinner werden nach Registrierungsschluss per Zufallsziehung
              unter allen gültigen Teilnahmen ermittelt – zunächst der Hauptgewinn, anschließend
              die Wertgutscheine in absteigender Reihenfolge ihres Werts. Eine gezogene Teilnahme
              sowie weitere Teilnahmen derselben Person werden bei den folgenden Ziehungen nicht
              mehr berücksichtigt. Die Gewinnerbekanntgabe erfolgt am {ANNOUNCEMENT_DATETIME_LABEL}{" "}
              (MESZ); die Benachrichtigung erfolgt über die
              angegebene E-Mail-Adresse und gegebenenfalls telefonisch. Meldet sich eine Gewinnerin
              oder ein Gewinner nicht innerhalb von 14 Tagen nach der Benachrichtigung oder kann
              kein gültiger Bestellnachweis erbracht werden, kann ersatzweise neu gezogen werden.
            </p>
            <p className="mt-2">
              Eine öffentliche Bekanntgabe erfolgt ohne gesonderte Einwilligung höchstens in
              datensparsamer Form (z. B. Vorname und abgekürzter Nachname oder
              Teilnahme-Referenz). Eine weitergehende Veröffentlichung erfolgt nur nach
              ausdrücklicher Einwilligung.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--gw-ink)]">6. Gewinnabwicklung</h2>
            <p className="mt-2">
              Die Gewinne sind nicht übertragbar; die Begleitperson der Reise kann frei gewählt
              werden. Eine Barauszahlung oder ein Umtausch der Gewinne ist ausgeschlossen. Die
              Wertgutscheine werden nach Bestätigung der Gewinnberechtigung (Rückmeldung und auf
              Anforderung Bestellnachweis) per E-Mail an die bei der Registrierung angegebene
              Adresse übermittelt. Kann ein Gewinn oder eine darin enthaltene Leistung aus Gründen,
              die der Veranstalter nicht zu vertreten hat, nicht erbracht werden (bei Wertgutscheinen
              z. B. bei Einstellung des Shops), erhält die jeweilige Gewinnerin bzw. der jeweilige
              Gewinner eine gleichwertige Ersatzleistung.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--gw-ink)]">
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
            <h2 className="text-lg font-semibold text-[var(--gw-ink)]">8. Datenschutz</h2>
            <p className="mt-2">
              Die im Formular erhobenen Daten werden ausschließlich zur Durchführung und
              Abwicklung des Gewinnspiels verarbeitet (Duplikatprüfung, Gewinnermittlung,
              Benachrichtigung, Gewinnabwicklung) und nicht zu Werbezwecken an Dritte übermittelt.
              Bestellnummern werden zur Duplikaterkennung als nicht rückrechenbarer Hash und im
              Übrigen verschlüsselt gespeichert. Nach Abschluss des Gewinnspiels werden die Daten
              gelöscht, soweit keine gesetzlichen Aufbewahrungspflichten bestehen. Teilnehmende
              können Auskunft, Berichtigung oder Löschung ihrer Daten jederzeit über{" "}
              {CONTACT_EMAIL} verlangen. Ergänzend gilt die auf der Aktionsseite verlinkte
              Datenschutzerklärung.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[var(--gw-ink)]">9. Schlussbestimmungen</h2>
            <p className="mt-2">
              Es gilt deutsches Recht; zwingende verbraucherschützende Bestimmungen des Staates,
              in dem Teilnehmende ihren gewöhnlichen Aufenthalt haben, bleiben unberührt. Der
              Rechtsweg ist hinsichtlich der Ziehung ausgeschlossen. Sollten einzelne Bestimmungen
              dieser Teilnahmebedingungen unwirksam sein, bleibt die Wirksamkeit der übrigen
              Bestimmungen unberührt.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
