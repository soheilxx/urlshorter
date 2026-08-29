/**
 * Validierung von ASIN- und ISBN-Kennungen (rein, unit-getestet).
 * Bei Büchern entspricht die ASIN häufig der ISBN-10 – das wird hier geprüft,
 * ersetzt aber NICHT die Bestätigung über eine Provider-API.
 */

/** ASIN: exakt 10 Zeichen, Großbuchstaben/Ziffern (Bücher: oft die ISBN-10). */
export function isValidAsin(value: string): boolean {
  return /^[A-Z0-9]{10}$/.test(value.trim().toUpperCase());
}

/** Entfernt Bindestriche/Leerzeichen aus einer ISBN. */
export function normalizeIsbn(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

/** ISBN-10-Prüfziffer (Modulo 11, "X" = 10). */
export function isValidIsbn10(value: string): boolean {
  const isbn = normalizeIsbn(value);
  if (!/^[0-9]{9}[0-9X]$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += (10 - i) * Number(isbn[i]);
  }
  sum += isbn[9] === "X" ? 10 : Number(isbn[9]);
  return sum % 11 === 0;
}

/** ISBN-13-Prüfziffer (EAN-13). */
export function isValidIsbn13(value: string): boolean {
  const isbn = normalizeIsbn(value);
  if (!/^[0-9]{13}$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(isbn[12]);
}

/** ISBN-13 → ISBN-10 (nur 978-Präfix; sonst null). */
export function isbn13ToIsbn10(value: string): string | null {
  const isbn = normalizeIsbn(value);
  if (!isValidIsbn13(isbn) || !isbn.startsWith("978")) return null;
  const core = isbn.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += (10 - i) * Number(core[i]);
  }
  const check = (11 - (sum % 11)) % 11;
  return core + (check === 10 ? "X" : String(check));
}

/**
 * Passen ASIN und ISBN-13 zusammen? (Bei Büchern ist die ASIN meist die
 * ISBN-10 derselben Ausgabe.) Nur ein Plausibilitätsindiz – die endgültige
 * Bestätigung erfolgt über die Provider-Antwort (externalIds).
 */
export function asinMatchesIsbn13(asin: string, isbn13: string): boolean {
  const derived = isbn13ToIsbn10(isbn13);
  return derived !== null && derived === normalizeIsbn(asin);
}

/** Rainforest-/Browse-Node-Kategorie-IDs: Ziffern (Browse Nodes) oder Slug. */
export function isValidProviderCategoryId(value: string): boolean {
  return /^[A-Za-z0-9._-]{1,64}$/.test(value.trim());
}
