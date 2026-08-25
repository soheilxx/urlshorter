import { redirect } from "next/navigation";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Die Startseite hat keine eigene Funktion – Besucher gelangen nur über
 * Kurzlinks (/{code}) auf die Domain. Wer die nackte Domain aufruft, wird
 * zur Hauptseite (ROOT_REDIRECT_URL, Standard: soheil-hosseini.de)
 * weitergeleitet, statt auf einer nutzlosen Seite zu landen.
 * Das Admin-Dashboard bleibt unter /admin erreichbar.
 */
export default function RootPage() {
  redirect(getEnv().ROOT_REDIRECT_URL);
}
