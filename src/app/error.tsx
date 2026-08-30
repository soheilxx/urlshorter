"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <h1 className="mb-2 text-xl font-semibold">Etwas ist schiefgelaufen</h1>
      <p className="mb-6 max-w-md text-sm text-zinc-500">
        Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-strong"
      >
        Erneut versuchen
      </button>
    </main>
  );
}
