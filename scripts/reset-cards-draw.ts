/**
 * Wartungsskript: Cards-Ziehung zurücksetzen und/oder Lose ausschließen –
 * über dieselbe Serverlogik wie die Bühne (/gewinner-cards), inkl. Audit-Log.
 *
 * Aufruf (Env-Datei mit DATABASE_URL und Sweepstakes-Secrets angeben):
 *   NODE_PATH=src/tests/stubs npx tsx scripts/reset-cards-draw.ts --env .env.local --actor admin@example.com [--reset] [--exclude LOSNR ...]
 *
 * --env      Pfad zur Env-Datei (Pflicht; für Produktion die gezogene .env.local)
 * --actor    E-Mail des handelnden Admins (Pflicht, landet im Audit-Log)
 * --reset    alle Ziehungen zurücknehmen (Lose zurück in den Topf, Protokoll leer)
 * --exclude  Los-Nummer(n), die als ungültig ausgeschlossen werden
 *
 * NODE_PATH zeigt auf den „server-only“-Ersatz, da die Serverlogik außerhalb
 * von Next.js läuft. Das Skript ist bewusst nur lesend, bis --reset/--exclude
 * angegeben sind.
 */
import dotenv from "dotenv";

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}
function args(name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === name && process.argv[i + 1]) out.push(process.argv[i + 1]!);
  }
  return out;
}

async function main() {
  const envPath = arg("--env");
  const actor = arg("--actor");
  if (!envPath || !actor) {
    throw new Error("Bitte --env <datei> und --actor <email> angeben.");
  }
  dotenv.config({ path: envPath, override: true });
  if (process.env.DATABASE_URL_UNPOOLED)
    process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;

  const draw = await import("@/lib/cards-draw");
  const before = await draw.getCardsDrawState();
  console.log(
    `Vorher: ${before.validLose} gültige Lose, ${before.participants} Personen, ${before.poolSize} im Topf, ${before.drawnTotal} gezogen, ${before.excluded} ausgeschlossen`,
  );

  if (process.argv.includes("--reset")) {
    const r = await draw.resetCardsDraw(actor);
    if (!r.ok) throw new Error(r.error);
    console.log(`Reset: ${r.count} Ziehungen zurückgenommen`);
  }
  for (const ref of args("--exclude")) {
    const state = await draw.getCardsDrawState();
    const lot = state.lots.find((l) => l.referenceNumber === ref);
    if (!lot) throw new Error(`Los ${ref} nicht gefunden.`);
    const r = await draw.setCardsLotExcluded({ entryId: lot.entryId, excluded: true, actor });
    if (!r.ok) throw new Error(`Los ${ref}: ${r.error}`);
    console.log(`Ausgeschlossen: ${ref} (${lot.displayName})`);
  }

  const after = await draw.getCardsDrawState();
  console.log(
    `Nachher: ${after.validLose} gültige Lose, ${after.participants} Personen, ${after.poolSize} im Topf, ${after.drawnTotal} gezogen, ${after.excluded} ausgeschlossen`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
