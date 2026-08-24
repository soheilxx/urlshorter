import { redirect } from "next/navigation";

/**
 * Die Wurzelseite hat keine öffentliche Funktion – Besucher gelangen nur über
 * Kurzlinks (/{code}) auf die Domain. Administratoren werden zum Dashboard
 * (bzw. Login) geleitet.
 */
export default function RootPage() {
  redirect("/admin");
}
