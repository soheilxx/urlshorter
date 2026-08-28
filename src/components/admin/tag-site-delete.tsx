"use client";

import { deleteTagSiteAction } from "@/actions/tag-site-actions";

/** Löschen mit Rückfrage – entfernt nur die Dashboard-Konfiguration. */
export function DeleteTagSiteButton({ id, label }: { id: string; label: string }) {
  return (
    <form
      action={deleteTagSiteAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Website „${label}“ wirklich löschen? Das Snippet liefert danach kein Tracking mehr für diese Site-ID. Bereits gespeicherte Events bleiben erhalten.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
      >
        Website löschen
      </button>
    </form>
  );
}
