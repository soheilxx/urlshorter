"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { setCardsLotExcludedAction } from "@/actions/cards-draw-actions";
import type { CardsDrawState } from "@/lib/cards-draw";
import { cn } from "@/lib/utils";

/**
 * Los-Verwaltung der Cards-Ziehung (nur Admin, NICHT für den Stream):
 * alle Lose mit Anzeigename und Status, Testeinträge markiert, Ausschließen /
 * Wiederaufnehmen. Bewusst von der Bühne getrennt, damit im Stream nie
 * sichtbar ist, welche Lose ausgeschlossen wurden.
 */

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: "im Topf",
  IN_REVIEW: "im Topf (in Prüfung)",
  REVIEWED: "im Topf (geprüft)",
  WINNER: "Gewinner",
  NOT_WON: "nicht gewonnen",
  INVALID: "ausgeschlossen",
};

export function LotManager({
  initialState,
  actor,
}: {
  initialState: CardsDrawState;
  actor: string;
}) {
  const [state, setState] = useState(initialState);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  async function toggle(entryId: string, excluded: boolean, reference: string) {
    if (busy) return;
    if (
      excluded &&
      !window.confirm(
        `Los ${reference} vom Topf ausschließen? Es nimmt dann nicht mehr an der Ziehung teil (protokolliert).`,
      )
    )
      return;
    setBusy(true);
    try {
      const result = await setCardsLotExcludedAction({ entryId, excluded });
      setState(result.state);
      setMessage(
        result.ok
          ? {
              kind: "info",
              text: excluded
                ? `Los ${result.referenceNumber} ausgeschlossen.`
                : `Los ${result.referenceNumber} wieder im Topf.`,
            }
          : { kind: "error", text: result.error },
      );
    } finally {
      setBusy(false);
    }
  }

  const suspiciousOpen = state.lots.filter((l) => l.suspicious && l.status !== "INVALID").length;

  return (
    <div className="tc-page cards-theme min-h-screen">
      <header className="tc-topbar">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div>
            <p className="cd-display text-base font-semibold text-[var(--cd-ink)]">
              Lose verwalten · Cards-Ziehung
            </p>
            <p className="text-xs text-[var(--cd-ink-mute)]">
              Interner Bereich · angemeldet als {actor} · nicht für den Stream
            </p>
          </div>
          <Link href="/gewinner-cards" className="tc-navbtn">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Zur Bühne
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 py-6 sm:px-8">
        <div className="rounded-2xl border border-[var(--cd-border-soft)] bg-[var(--cd-surface)] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="cd-display text-lg font-semibold text-[var(--cd-ink)]">
              Lose prüfen & ausschließen ({state.lots.length})
            </h1>
            <p className="text-xs text-[var(--cd-ink-mute)]" data-testid="lots-summary">
              {state.poolSize} im Topf · {state.drawnTotal} gezogen ·{" "}
              <span data-testid="lots-excluded">{state.excluded}</span> ausgeschlossen
              {suspiciousOpen ? (
                <span className="ml-2 rounded-full bg-[rgba(231,92,88,0.18)] px-2 py-0.5 font-semibold text-[var(--cd-red)]">
                  {suspiciousOpen} Testeintrag/-einträge prüfen
                </span>
              ) : null}
            </p>
          </div>
          <p className="mt-2 text-xs text-[var(--cd-ink-mute)]">
            Ausschließen setzt das Los auf „ungültig“ (protokolliert) – z. B. eigene Testeinträge.
            Gewinner-Lose müssen zuerst auf der Bühne verworfen werden.
          </p>
          {message ? (
            <p
              role={message.kind === "error" ? "alert" : "status"}
              className={cn(
                "mt-3 rounded-lg px-3 py-2 text-sm",
                message.kind === "error"
                  ? "border border-[var(--gw-error-border)] bg-[var(--gw-error-bg)] text-[var(--gw-error-ink-strong)]"
                  : "border border-[var(--cd-border)] bg-[rgba(255,213,106,0.08)] text-[var(--cd-ink)]",
              )}
              data-testid="lots-message"
            >
              {message.text}
            </p>
          ) : null}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs tracking-wider text-[var(--cd-ink-mute)] uppercase">
                <tr>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Los-Nr.</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Aktion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--cd-border-soft)]">
                {state.lots.map((lot) => (
                  <tr
                    key={lot.entryId}
                    data-testid={`lot-${lot.referenceNumber}`}
                    className={cn(
                      lot.suspicious && lot.status !== "INVALID" && "bg-[rgba(231,92,88,0.08)]",
                    )}
                  >
                    <td className="py-1.5 pr-3 text-[var(--cd-ink)]">
                      {lot.displayName}
                      {lot.suspicious ? (
                        <span className="ml-2 text-xs font-semibold text-[var(--cd-red)]">
                          Testeintrag?
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-3 font-mono text-[var(--tc-led)]">
                      {lot.referenceNumber}
                    </td>
                    <td className="py-1.5 pr-3 text-[var(--cd-ink-soft)]">
                      {STATUS_LABEL[lot.status] ?? lot.status}
                    </td>
                    <td className="py-1.5">
                      {lot.status === "INVALID" ? (
                        <button
                          type="button"
                          className="tc-navbtn tc-navbtn--sm"
                          disabled={busy}
                          onClick={() => toggle(lot.entryId, false, lot.referenceNumber)}
                        >
                          Wieder aufnehmen
                        </button>
                      ) : lot.status === "WINNER" || lot.status === "NOT_WON" ? (
                        <span className="text-xs text-[var(--cd-ink-mute)]">–</span>
                      ) : (
                        <button
                          type="button"
                          className="tc-navbtn tc-navbtn--sm"
                          disabled={busy}
                          onClick={() => toggle(lot.entryId, true, lot.referenceNumber)}
                          data-testid="lot-exclude"
                        >
                          Ausschließen
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
