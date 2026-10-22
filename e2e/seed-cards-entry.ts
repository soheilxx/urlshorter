import { createFormToken } from "@/lib/sweepstakes-crypto";
import { submitSweepstakesEntry } from "@/lib/sweepstakes";

/**
 * Test-Seed (nur E2E): legt ein Cards-Los über den echten Service an, mit
 * einem Zeitpunkt innerhalb der Teilnahmephase – das Live-Formular ist seit
 * dem 06.10.2026 geschlossen, die Ziehung muss aber weiterhin testbar sein.
 *
 * Aufruf (aus einer Spec, Env aus .env.test, NODE_PATH auf src/tests/stubs
 * für den „server-only“-Ersatz):
 *   node node_modules/tsx/dist/cli.mjs e2e/seed-cards-entry.ts <Bestellnummer> <E-Mail>
 * Gibt eine JSON-Zeile mit dem Service-Ergebnis aus.
 */

const OPEN_MOMENT = new Date("2026-09-25T12:00:00+02:00");

async function main() {
  const [orderNumber, email] = process.argv.slice(2);
  if (!orderNumber || !email) {
    throw new Error("Aufruf: seed-cards-entry.ts <Bestellnummer> <E-Mail>");
  }
  const result = await submitSweepstakesEntry(
    {
      retailer: "amazon",
      orderNumber,
      firstName: "Ziehung",
      lastName: "Test",
      street: "Losweg",
      houseNumber: "7",
      postalCode: "20095",
      city: "Hamburg",
      country: "Deutschland",
      email,
      phone: "+49 170 7654321",
      consent: true,
    },
    {
      campaign: "cards_2026",
      now: OPEN_MOMENT,
      submissionIdentifier: `e2e-seed-${orderNumber}`,
      honeypot: null,
      formToken: createFormToken(OPEN_MOMENT.getTime() - 10_000),
      utm: { source: null, medium: null, campaign: null, content: null, term: null },
      referrer: null,
      landingHost: "127.0.0.1",
      landingPath: "/cards",
    },
  );
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(result.ok ? 0 : 1);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
