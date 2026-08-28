import { z } from "zod";

/**
 * Normalisierung + Validierung der Gewinnspiel-Eingaben.
 * Bewusst ohne Server-Abhängigkeiten (reine Funktionen, unit-testbar).
 *
 * Bestellnummern: Händlerformate sind nicht verbindlich dokumentiert, daher
 * bewusst tolerant validieren (Länge, Zeichenvorrat, Mindestgehalt an Ziffern)
 * statt händlerspezifisch zu raten.
 */

export interface NormalizeResult {
  ok: boolean;
  value: string;
  error: string | null;
}

/** Bestellnummer normalisieren: trimmen, Großschreibung, Mehrfach-Leerzeichen bündeln. */
export function normalizeOrderNumber(raw: string): NormalizeResult {
  const value = raw.trim().replace(/\s+/g, " ").toUpperCase();
  if (value.length < 4 || value.length > 40) {
    return {
      ok: false,
      value,
      error: "Die Bestellnummer muss zwischen 4 und 40 Zeichen lang sein.",
    };
  }
  if (!/^[A-Z0-9 ._\-/#]+$/.test(value)) {
    return {
      ok: false,
      value,
      error:
        "Die Bestellnummer darf nur Buchstaben, Zahlen sowie Leerzeichen, Punkt, Bindestrich, Unterstrich, Schrägstrich und # enthalten.",
    };
  }
  const digits = value.replace(/[^0-9]/g, "").length;
  if (digits < 2) {
    return {
      ok: false,
      value,
      error: "Bitte prüfe die Bestellnummer – sie enthält zu wenige Ziffern.",
    };
  }
  // Offensichtlich fehlerhafte Eingaben (z. B. "0000", "1234----")
  const distinct = new Set(value.replace(/[^A-Z0-9]/g, "").split(""));
  if (distinct.size < 2) {
    return { ok: false, value, error: "Bitte prüfe die Bestellnummer – die Eingabe wirkt unvollständig." };
  }
  return { ok: true, value, error: null };
}

/** E-Mail normalisieren (Kleinschreibung, getrimmt). */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Telefonnummer inkl. Ländervorwahl normalisieren:
 * erlaubt +49…, 0049…; Trennzeichen werden entfernt. Ergebnis: +<7–15 Ziffern>.
 */
export function normalizePhone(raw: string): NormalizeResult {
  let value = raw.trim().replace(/[\s()./-]+/g, "");
  if (value.startsWith("00")) value = `+${value.slice(2)}`;
  if (!value.startsWith("+")) {
    return {
      ok: false,
      value,
      error: "Bitte gib die Telefonnummer mit Ländervorwahl an, z. B. +49 151 12345678.",
    };
  }
  const digits = value.slice(1);
  if (!/^[0-9]{7,15}$/.test(digits)) {
    return {
      ok: false,
      value,
      error: "Bitte prüfe die Telefonnummer – erwartet werden 7 bis 15 Ziffern nach der Ländervorwahl.",
    };
  }
  return { ok: true, value: `+${digits}`, error: null };
}

const nameField = (label: string) =>
  z
    .string({ message: `Bitte ${label} angeben.` })
    .trim()
    .min(1, `Bitte ${label} angeben.`)
    .max(100, `${label} ist zu lang.`);

/** Zod-Schema der Formulareingaben (vor Normalisierung von Bestellnummer/Telefon). */
export const sweepstakesInputSchema = z.object({
  retailer: z.string().min(1, "Bitte einen Händler auswählen."),
  retailerOther: z.string().trim().max(120, "Der Händlername ist zu lang.").optional(),
  orderNumber: z
    .string({ message: "Bitte die Bestellnummer angeben." })
    .trim()
    .min(1, "Bitte die Bestellnummer angeben."),
  firstName: nameField("deinen Vornamen"),
  lastName: nameField("deinen Nachnamen"),
  street: nameField("die Straße"),
  houseNumber: z
    .string({ message: "Bitte die Hausnummer angeben." })
    .trim()
    .min(1, "Bitte die Hausnummer angeben.")
    .max(20, "Die Hausnummer ist zu lang."),
  postalCode: z
    .string({ message: "Bitte die Postleitzahl angeben." })
    .trim()
    .min(3, "Bitte eine gültige Postleitzahl angeben.")
    .max(12, "Bitte eine gültige Postleitzahl angeben."),
  city: nameField("den Ort"),
  country: nameField("das Land"),
  email: z
    .string({ message: "Bitte deine E-Mail-Adresse angeben." })
    .trim()
    .toLowerCase()
    .email("Bitte eine gültige E-Mail-Adresse angeben.")
    .max(200, "Die E-Mail-Adresse ist zu lang."),
  phone: z
    .string({ message: "Bitte deine Telefonnummer angeben." })
    .trim()
    .min(1, "Bitte deine Telefonnummer angeben."),
  confirmAccuracy: z.literal(true, {
    errorMap: () => ({
      message: "Bitte bestätige, dass deine Angaben vollständig und korrekt sind.",
    }),
  }),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "Bitte akzeptiere die Teilnahmebedingungen." }),
  }),
  acknowledgePrivacy: z.literal(true, {
    errorMap: () => ({
      message: "Bitte bestätige die Kenntnisnahme der Datenschutzhinweise.",
    }),
  }),
});

export type SweepstakesInput = z.infer<typeof sweepstakesInputSchema>;

/**
 * Schutz vor CSV-Injection: Zellen, die mit Formel-Zeichen beginnen,
 * werden mit einem Apostroph neutralisiert; Anführungszeichen verdoppelt.
 */
export function csvCell(value: string | null | undefined): string {
  const raw = value ?? "";
  const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

/** E-Mail für Übersichten maskieren: "m***@beispiel.de" */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}
