export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <h1 className="mb-2 text-xl font-semibold">Seite nicht gefunden</h1>
      <p className="max-w-md text-sm text-zinc-500">
        Die aufgerufene Seite existiert nicht. Bitte prüfe die Adresse auf Tippfehler.
      </p>
    </main>
  );
}
