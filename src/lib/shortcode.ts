import { randomInt } from "node:crypto";

export const SHORT_CODE_LENGTH = 4;
export const SHORT_CODE_PATTERN = /^[a-z]{4}$/;

const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

/** Prüft, ob ein Wert ein gültiger Kurzcode ist (exakt 4 Kleinbuchstaben a–z). */
export function isValidShortCode(value: unknown): value is string {
  return typeof value === "string" && SHORT_CODE_PATTERN.test(value);
}

/**
 * Erzeugt einen kryptografisch sicheren, zufälligen 4-Buchstaben-Code.
 * `crypto.randomInt` ist gleichverteilt und nicht vorhersagbar – es entstehen
 * keine fortlaufenden oder erratbaren Codes.
 */
export function generateShortCode(): string {
  let code = "";
  for (let i = 0; i < SHORT_CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

/**
 * Erzeugt einen Code, der laut `isTaken` noch frei ist. Bei Kollisionen wird
 * automatisch neu generiert. Die endgültige Eindeutigkeit sichert zusätzlich
 * der Unique Constraint der Datenbank ab (Race-Condition-Schutz).
 */
export async function generateUniqueShortCode(
  isTaken: (code: string) => Promise<boolean>,
  maxAttempts = 30,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateShortCode();
    if (!(await isTaken(code))) return code;
  }
  throw new Error(
    `Kein freier Kurzcode nach ${maxAttempts} Versuchen gefunden. Der Code-Raum (26^4) ist möglicherweise stark ausgelastet.`,
  );
}
