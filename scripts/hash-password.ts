/**
 * Erzeugt einen bcrypt-Hash für ADMIN_PASSWORD_HASH.
 *
 * Verwendung:
 *   npm run hash-password                # interaktive Eingabe (verdeckt)
 *   npm run hash-password -- "Passwort"  # direkt als Argument (Vorsicht: Shell-History)
 */
import { hashSync } from "bcryptjs";
import { createInterface } from "node:readline";

const ROUNDS = 12;

function printResult(password: string): void {
  if (password.length < 12) {
    console.error("\nFehler: Das Passwort muss mindestens 12 Zeichen lang sein.");
    process.exit(1);
  }
  const hash = hashSync(password, ROUNDS);
  const base64 = Buffer.from(hash, "utf8").toString("base64");
  console.log("\nEmpfohlen (immun gegen $-Expansion durch Env-Loader):\n");
  console.log(`ADMIN_PASSWORD_HASH_BASE64="${base64}"`);
  console.log("\nAlternative (Klartext-Hash, nur wenn garantiert keine Expansion stattfindet):\n");
  console.log(`ADMIN_PASSWORD_HASH='${hash}'`);
}

const argPassword = process.argv[2];
if (argPassword) {
  printResult(argPassword);
} else {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.question("Admin-Passwort (min. 12 Zeichen): ", (answer) => {
    rl.close();
    printResult(answer);
  });
}
