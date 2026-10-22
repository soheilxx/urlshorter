"use client";

import { Download, RotateCcw, Trophy, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  drawCardsWinnerAction,
  markRemainingCardsNotWonAction,
  undoLastCardsDrawAction,
} from "@/actions/cards-draw-actions";
import { CardsConfetti } from "@/components/cards/cards-confetti";
import { DrawSynth } from "@/components/draw/draw-sounds";
import type { CardsPrizeId } from "@/lib/cards-giveaway-config";
import type { CardsDrawState, DrawRecord } from "@/lib/cards-draw";
import { cn } from "@/lib/utils";

/**
 * „Triple Chance“-Ziehungsautomat (nur Admin): drei Walzen mit Los-Nummern,
 * die nacheinander einrasten und alle auf dem gezogenen Los stehen bleiben
 * (Vollbild = Gewinn). Danach Lampenlauf, „TRIPLE CHANCE“-Banner, Fanfare und
 * die Gewinnerkarte (Los-Nr. + Bestellnummer, nie Namen).
 *
 * Fairness: Der Gewinner wird VOR dem Walzenlauf serverseitig gezogen
 * (crypto.randomInt) und protokolliert – die Walzen zeigen nur das Ergebnis.
 * Das Protokoll in der Oberfläche wird bewusst erst nach der Enthüllung
 * aktualisiert, damit das Publikum nichts vorab sieht.
 */

const CELL = 76;
const REPEAT = 9;
const MIN_SYMBOLS = 14;
const REEL_DURATIONS = [2200, 3400, 4700];
const WORLD_COLOR: Record<string, string> = {
  onepiece: "var(--cd-gold)",
  dragonball: "var(--cd-orange)",
  yugioh: "var(--cd-violet)",
  cardmarket: "var(--cd-cm-blue)",
};

type Phase = "idle" | "spinning" | "triple" | "reveal";

function easeOutCubic(p: number) {
  return 1 - Math.pow(1 - p, 3);
}

function buildSymbols(winner: string, decoys: string[], seed: number): string[] {
  const pool = decoys.filter((d) => d !== winner);
  // leichte Variation je Walze
  const rotated = pool.length
    ? [...pool.slice(seed % pool.length), ...pool.slice(0, seed % pool.length)]
    : [];
  const symbols: string[] = [winner];
  let i = 0;
  while (symbols.length < MIN_SYMBOLS) {
    symbols.push(rotated.length ? rotated[i % rotated.length]! : "— — —");
    i++;
  }
  return symbols;
}

function formatBerlin(iso: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Europe/Berlin",
  }).format(new Date(iso));
}

export function TripleChanceDraw({
  initialState,
  prizeVisuals,
  actor,
  exportHref,
}: {
  initialState: CardsDrawState;
  prizeVisuals: Record<CardsPrizeId, ReactNode>;
  actor: string;
  exportHref: string;
}) {
  const [state, setState] = useState(initialState);
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [onePrizePerPerson, setOnePrizePerPerson] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [current, setCurrent] = useState<DrawRecord | null>(null);
  const [symbols, setSymbols] = useState<string[][]>([[], [], []]);
  const [stopped, setStopped] = useState<boolean[]>([false, false, false]);
  const [selectedPrize, setSelectedPrize] = useState<CardsPrizeId>(
    () =>
      [...initialState.prizes].reverse().find((p) => p.remaining > 0)?.id ??
      initialState.prizes[0]!.id,
  );

  const synth = useRef<DrawSynth | null>(null);
  const stripRefs = useRef<Array<HTMLDivElement | null>>([null, null, null]);
  const pendingState = useRef<CardsDrawState | null>(null);
  const frame = useRef<number>(0);
  const timers = useRef<number[]>([]);

  if (!synth.current && typeof window !== "undefined") synth.current = new DrawSynth();

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("lze_draw_sound");
      if (stored === "0") setSoundOn(false);
    } catch {
      /* ohne Storage: Standard an */
    }
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const pendingTimers = timers.current;
    return () => {
      cancelAnimationFrame(frame.current);
      pendingTimers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    if (synth.current) synth.current.enabled = soundOn;
    try {
      window.localStorage.setItem("lze_draw_sound", soundOn ? "1" : "0");
    } catch {
      /* ignorieren */
    }
  }, [soundOn]);

  const selected = state.prizes.find((p) => p.id === selectedPrize) ?? state.prizes[0]!;
  const canDraw =
    phase === "idle" &&
    !busy &&
    state.poolSize > 0 &&
    selected.remaining > 0 &&
    state.remainingTotal > 0;

  const later = useCallback((fn: () => void, ms: number) => {
    const t = window.setTimeout(fn, ms);
    timers.current.push(t);
  }, []);

  const finishReveal = useCallback(() => {
    setPhase("reveal");
    synth.current?.fanfare();
    if (pendingState.current) {
      setState(pendingState.current);
      pendingState.current = null;
    }
  }, []);

  const tripleThenReveal = useCallback(() => {
    setPhase("triple");
    synth.current?.stopSuspense();
    synth.current?.tripleChance();
    const lampTicks = reducedMotion ? 0 : 10;
    for (let i = 0; i < lampTicks; i++) later(() => synth.current?.lamp(), i * 120);
    later(finishReveal, reducedMotion ? 500 : 1800);
  }, [finishReveal, later, reducedMotion]);

  /** Walzenlauf: alle drei Walzen landen auf dem Gewinner-Los (Mittelreihe). */
  const spinReels = useCallback(
    (reelSymbols: string[][]) => {
      const finals = reelSymbols.map((syms) => {
        const L = syms.length;
        const winnerIdx = (REPEAT - 2) * L;
        return { L, finalY: -(winnerIdx - 1) * CELL, startY: -(L - 1) * CELL };
      });
      const stripsEl = stripRefs.current;
      finals.forEach((f, i) => {
        const el = stripsEl[i];
        if (!el) return;
        el.style.setProperty("--tc-final", `${f.finalY}px`);
        el.style.transform = `translate3d(0, ${reducedMotion ? f.finalY : f.startY}px, 0)`;
      });

      if (reducedMotion) {
        [0, 1, 2].forEach((i) =>
          later(
            () => {
              synth.current?.reelStop(i);
              setStopped((s) => s.map((v, k) => (k === i ? true : v)));
            },
            250 + i * 250,
          ),
        );
        later(tripleThenReveal, 1100);
        return;
      }

      const t0 = performance.now();
      const starts = [0, 140, 280];
      const durations = REEL_DURATIONS.map((d) => d + Math.round(Math.random() * 160 - 80));
      const lastCell = [0, 0, 0];
      const lastTick = [0, 0, 0];
      const done = [false, false, false];
      let suspenseStarted = false;

      const step = (now: number) => {
        let allDone = true;
        for (let i = 0; i < 3; i++) {
          if (done[i]) continue;
          allDone = false;
          const el = stripsEl[i];
          const f = finals[i]!;
          if (!el) continue;
          const elapsed = now - t0 - starts[i]!;
          if (elapsed < 0) continue;
          const p = Math.min(1, elapsed / durations[i]!);
          const y = f.startY + (f.finalY - f.startY) * easeOutCubic(p);
          el.style.transform = `translate3d(0, ${y}px, 0)`;
          const cell = Math.floor(-y / CELL);
          if (cell !== lastCell[i] && now - lastTick[i]! > 38) {
            lastCell[i] = cell;
            lastTick[i] = now;
            synth.current?.tick(1 - p);
          }
          if (p >= 1) {
            done[i] = true;
            el.style.transform = `translate3d(0, ${f.finalY}px, 0)`;
            synth.current?.reelStop(i);
            setStopped((s) => s.map((v, k) => (k === i ? true : v)));
            if (i === 1) {
              synth.current?.match();
              if (!suspenseStarted) {
                suspenseStarted = true;
                const remaining = t0 + starts[2]! + durations[2]! - now;
                synth.current?.startSuspense(Math.max(400, remaining));
              }
            }
          }
        }
        if (!allDone) {
          frame.current = requestAnimationFrame(step);
        } else {
          later(tripleThenReveal, 250);
        }
      };
      frame.current = requestAnimationFrame(step);
    },
    [later, reducedMotion, tripleThenReveal],
  );

  async function startDraw() {
    if (!canDraw) return;
    setMessage(null);
    setBusy(true);
    synth.current?.unlock();
    synth.current?.start();
    try {
      const result = await drawCardsWinnerAction({ prizeId: selected.id, onePrizePerPerson });
      if (!result.ok) {
        setState(result.state);
        setMessage({ kind: "error", text: result.error });
        synth.current?.error();
        return;
      }
      pendingState.current = result.state;
      setCurrent(result.draw);
      setStopped([false, false, false]);
      const reelSymbols = [0, 1, 2].map((i) =>
        buildSymbols(result.draw.referenceNumber, result.reelStrip, i * 5 + 1),
      );
      setSymbols(reelSymbols);
      setPhase("spinning");
      // Strip-DOM nach dem Render positionieren
      requestAnimationFrame(() => spinReels(reelSymbols));
    } catch {
      setMessage({
        kind: "error",
        text: "Die Ziehung konnte nicht gestartet werden. Bitte erneut versuchen.",
      });
      synth.current?.error();
    } finally {
      setBusy(false);
    }
  }

  function closeReveal() {
    setPhase("idle");
    const stillOpen = state.prizes.find((p) => p.id === selectedPrize && p.remaining > 0);
    if (!stillOpen) {
      const next = [...state.prizes].reverse().find((p) => p.remaining > 0);
      if (next) setSelectedPrize(next.id);
    }
  }

  async function undoLast() {
    if (phase !== "idle" || busy) return;
    const last = state.draws[state.draws.length - 1];
    if (!last) return;
    if (
      !window.confirm(
        `Letzte Ziehung verwerfen?\n\nZiehung ${last.sequence}: Los ${last.referenceNumber} (${last.prizeHeadline}) geht zurück in den Topf. Dieser Schritt wird protokolliert.`,
      )
    )
      return;
    setBusy(true);
    try {
      const result = await undoLastCardsDrawAction();
      setState(result.state);
      setMessage(
        result.ok
          ? {
              kind: "info",
              text: `Ziehung verworfen – Los ${result.reference} ist wieder im Topf.`,
            }
          : { kind: "error", text: result.error },
      );
    } finally {
      setBusy(false);
    }
  }

  async function markNotWon() {
    if (phase !== "idle" || busy) return;
    if (
      !window.confirm(
        `Alle ${state.poolSize} verbliebenen Lose als „Nicht gewonnen“ markieren? Dieser Schritt wird protokolliert.`,
      )
    )
      return;
    setBusy(true);
    try {
      const result = await markRemainingCardsNotWonAction();
      setState(result.state);
      setMessage(
        result.ok
          ? { kind: "info", text: `${result.count} Lose als „Nicht gewonnen“ markiert.` }
          : { kind: "error", text: result.error },
      );
    } finally {
      setBusy(false);
    }
  }

  const active = phase === "spinning" || phase === "triple";
  const win = phase === "triple" || phase === "reveal";
  const nextSequence = state.drawnTotal + 1;
  const reelCells = useMemo(
    () =>
      symbols.map((syms) => {
        const cells: string[] = [];
        for (let r = 0; r < REPEAT; r++) cells.push(...syms);
        return cells;
      }),
    [symbols],
  );

  return (
    <div className="tc-page cards-theme min-h-screen">
      <header className="border-b border-[var(--cd-border-soft)] bg-[rgba(8,12,24,0.85)] backdrop-blur">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-[var(--cd-gold)]" aria-hidden="true" />
            <div>
              <p className="cd-display text-base font-semibold text-[var(--cd-ink)]">
                Gewinnziehung Cards · Triple Chance
              </p>
              <p className="text-xs text-[var(--cd-ink-mute)]">
                Interner Bereich · angemeldet als {actor} · Kampagne cards_2026
              </p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              href="/admin/gewinnspiel?campaign=cards_2026"
              className="inline-flex min-h-[40px] items-center rounded-lg border border-[var(--cd-border-soft)] px-3 text-[var(--cd-ink-soft)] hover:text-[var(--cd-ink)]"
            >
              Admin · Teilnahmen
            </Link>
            <a
              href={exportHref}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[var(--cd-border-soft)] px-3 text-[var(--cd-ink-soft)] hover:text-[var(--cd-ink)]"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Gewinner-CSV
            </a>
            <button
              type="button"
              onClick={() => {
                synth.current?.unlock();
                setSoundOn((v) => !v);
              }}
              aria-pressed={soundOn}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[var(--cd-border-soft)] px-3 text-[var(--cd-ink-soft)] hover:text-[var(--cd-ink)]"
            >
              {soundOn ? (
                <Volume2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <VolumeX className="h-4 w-4" aria-hidden="true" />
              )}
              Sound {soundOn ? "an" : "aus"}
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1320px] gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)] lg:py-10">
        {/* Automat */}
        <section
          aria-labelledby="tc-heading"
          className="tc-cabinet"
          data-active={active ? "1" : "0"}
          data-win={win ? "1" : "0"}
        >
          <div className="tc-lamps" aria-hidden="true" />
          <div className="tc-lamps tc-lamps--bottom" aria-hidden="true" />
          <div className="tc-lamps tc-lamps--side tc-lamps--left" aria-hidden="true" />
          <div className="tc-lamps tc-lamps--side tc-lamps--right" aria-hidden="true" />

          <div className="tc-marquee">
            <h1 id="tc-heading">Triple Chance</h1>
            <p>
              Cards-Gewinnspiel · Ziehung {Math.min(nextSequence, state.totalPrizes)} von{" "}
              {state.totalPrizes}
            </p>
          </div>

          <div className="relative mx-3 sm:mx-6">
            <div className="tc-window" data-win={win ? "1" : "0"} data-testid="tc-window">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={cn("tc-reel", stopped[i] && "tc-reel--stopped")}
                  data-testid={`tc-reel-${i}`}
                >
                  <div
                    ref={(el) => {
                      stripRefs.current[i] = el;
                    }}
                    className="tc-strip"
                  >
                    {reelCells[i]!.length === 0
                      ? [0, 1, 2].map((k) => (
                          <div key={k} className="tc-cell tc-cell--blank">
                            {k === 1 ? "READY" : "· · ·"}
                          </div>
                        ))
                      : reelCells[i]!.map((sym, k) => {
                          const L = symbols[i]!.length;
                          const isWinnerCell = k === (REPEAT - 2) * L;
                          return (
                            <div
                              key={k}
                              className={cn("tc-cell", isWinnerCell && win && "tc-cell--win")}
                              data-winner={isWinnerCell ? "1" : undefined}
                            >
                              {sym}
                            </div>
                          );
                        })}
                  </div>
                </div>
              ))}
              <div className="tc-payline" aria-hidden="true" />
              {phase === "triple" ? (
                <div className="tc-banner" aria-hidden="true">
                  <span>Triple Chance</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex flex-col items-center gap-4 px-3 pb-4 sm:flex-row sm:justify-between sm:px-6">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="tc-led" data-testid="tc-pool">
                LOSE IM TOPF {String(state.poolSize).padStart(4, "0")}
              </span>
              <span className="tc-led" data-testid="tc-drawn">
                GEZOGEN {String(state.drawnTotal).padStart(2, "0")}/{state.totalPrizes}
              </span>
            </div>
            <button
              type="button"
              className="tc-start"
              data-armed={canDraw ? "1" : "0"}
              disabled={!canDraw}
              onClick={startDraw}
              data-testid="tc-start"
            >
              {busy
                ? "Ziehung läuft …"
                : phase === "spinning" || phase === "triple"
                  ? "Walzen laufen"
                  : "Start"}
            </button>
          </div>

          <p className="px-3 pb-3 text-center text-xs text-[var(--cd-ink-mute)] sm:px-6">
            Nächster Gewinn: <strong className="text-[var(--cd-ink)]">{selected.headline}</strong> ·
            jede Bestellnummer ist ein Los · ein Los gewinnt höchstens einmal · der Zufall wird
            serverseitig entschieden und protokolliert.
          </p>
        </section>

        {/* Gewinnleiter + Optionen */}
        <aside className="space-y-4">
          <div className="cd-holo rounded-2xl bg-[var(--cd-surface)] p-4 sm:p-5">
            <h2 className="cd-display text-lg font-semibold text-[var(--cd-ink)]">Gewinnleiter</h2>
            <p className="mt-1 text-xs text-[var(--cd-ink-mute)]">
              Kategorie wählen, dann Start. Reihenfolge frei – empfohlen: Gutscheine, Yu-Gi-Oh!,
              Dragon Ball, zuletzt der Hauptgewinn.
            </p>
            <div
              className="tc-ladder mt-4 space-y-2"
              role="radiogroup"
              aria-label="Nächster Gewinn"
            >
              {state.prizes.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={selectedPrize === p.id}
                  data-selected={selectedPrize === p.id ? "1" : "0"}
                  data-testid={`tc-prize-${p.id}`}
                  disabled={phase !== "idle" || p.remaining === 0}
                  onClick={() => setSelectedPrize(p.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold text-[var(--cd-ink)]">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: WORLD_COLOR[p.world] }}
                          aria-hidden="true"
                        />
                        {p.headline}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[var(--cd-ink-soft)]">{p.unit}</p>
                      <p className="mt-0.5 text-xs text-[var(--cd-ink-mute)]">
                        {p.drawn} von {p.total} gezogen · {p.remaining} offen
                      </p>
                    </div>
                    <span
                      className="tc-pips mt-1 shrink-0 flex-wrap justify-end"
                      style={{ maxWidth: 90 }}
                      aria-hidden="true"
                    >
                      {Array.from({ length: p.total }, (_, k) => (
                        <i key={k} data-on={k < p.drawn ? "1" : "0"} />
                      ))}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--cd-border-soft)] bg-[var(--cd-surface)] p-4 sm:p-5">
            <h2 className="cd-display text-lg font-semibold text-[var(--cd-ink)]">Topf & Regeln</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[var(--cd-ink-mute)]">Gültige Lose</dt>
                <dd className="font-semibold text-[var(--cd-ink)]">{state.validLose}</dd>
              </div>
              <div>
                <dt className="text-[var(--cd-ink-mute)]">Teilnehmende</dt>
                <dd className="font-semibold text-[var(--cd-ink)]">{state.participants}</dd>
              </div>
              <div>
                <dt className="text-[var(--cd-ink-mute)]">Noch im Topf</dt>
                <dd className="font-semibold text-[var(--cd-ink)]">{state.poolSize}</dd>
              </div>
              <div>
                <dt className="text-[var(--cd-ink-mute)]">Gewinne offen</dt>
                <dd className="font-semibold text-[var(--cd-ink)]">{state.remainingTotal}</dd>
              </div>
            </dl>
            <label className="mt-4 flex items-start gap-3 text-sm text-[var(--cd-ink-soft)]">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[var(--cd-gold)]"
                checked={onePrizePerPerson}
                disabled={phase !== "idle"}
                onChange={(e) => setOnePrizePerPerson(e.target.checked)}
                data-testid="tc-one-per-person"
              />
              <span>
                Höchstens ein Gewinn je Person (E-Mail).{" "}
                <span className="text-[var(--cd-ink-mute)]">
                  Standard laut Veranstalter: aus – mehrere Lose derselben Person können mehrfach
                  gewinnen.
                </span>
              </span>
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={undoLast}
                disabled={phase !== "idle" || busy || state.draws.length === 0}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[var(--cd-border-soft)] px-3 text-sm text-[var(--cd-ink-soft)] hover:text-[var(--cd-ink)] disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="tc-undo"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Letzte Ziehung verwerfen
              </button>
              {state.remainingTotal === 0 && state.poolSize > 0 ? (
                <button
                  type="button"
                  onClick={markNotWon}
                  disabled={phase !== "idle" || busy}
                  className="inline-flex min-h-[40px] items-center rounded-lg border border-[var(--cd-border-soft)] px-3 text-sm text-[var(--cd-ink-soft)] hover:text-[var(--cd-ink)] disabled:opacity-50"
                >
                  Restliche Lose als „Nicht gewonnen“ markieren
                </button>
              ) : null}
            </div>
            {message ? (
              <p
                role={message.kind === "error" ? "alert" : "status"}
                className={cn(
                  "mt-3 rounded-lg px-3 py-2 text-sm",
                  message.kind === "error"
                    ? "border border-[var(--gw-error-border)] bg-[var(--gw-error-bg)] text-[var(--gw-error-ink-strong)]"
                    : "border border-[var(--cd-border)] bg-[rgba(255,213,106,0.08)] text-[var(--cd-ink)]",
                )}
              >
                {message.text}
              </p>
            ) : null}
          </div>
        </aside>

        {/* Protokoll */}
        <section className="lg:col-span-2" aria-labelledby="tc-protocol-heading">
          <div className="rounded-2xl border border-[var(--cd-border-soft)] bg-[var(--cd-surface)] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2
                id="tc-protocol-heading"
                className="cd-display text-lg font-semibold text-[var(--cd-ink)]"
              >
                Ziehungsprotokoll
              </h2>
              <p className="text-xs text-[var(--cd-ink-mute)]">
                {state.draws.length} von {state.totalPrizes} Gewinnen gezogen · Zufall:
                crypto.randomInt(Topfgröße)
              </p>
            </div>
            {state.draws.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--cd-ink-mute)]">Noch keine Ziehung.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm" data-testid="tc-protocol">
                  <thead className="text-xs tracking-wider text-[var(--cd-ink-mute)] uppercase">
                    <tr>
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">Zeit</th>
                      <th className="py-2 pr-3">Gewinn</th>
                      <th className="py-2 pr-3">Los-Nr.</th>
                      <th className="py-2 pr-3">Bestellnummer</th>
                      <th className="py-2 pr-3">Händler</th>
                      <th className="py-2 pr-3">Topf / Index</th>
                      <th className="py-2">Gezogen von</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--cd-border-soft)]">
                    {[...state.draws].reverse().map((d) => (
                      <tr key={d.id}>
                        <td className="py-2 pr-3 font-semibold text-[var(--cd-ink)]">
                          {d.sequence}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap text-[var(--cd-ink-soft)]">
                          {formatBerlin(d.drawnAt)}
                        </td>
                        <td className="py-2 pr-3 text-[var(--cd-ink)]">
                          <span
                            className="mr-2 inline-block h-2 w-2 rounded-full"
                            style={{ background: WORLD_COLOR[d.world] }}
                            aria-hidden="true"
                          />
                          {d.prizeUnit}
                        </td>
                        <td className="py-2 pr-3 font-mono font-semibold text-[var(--tc-led)]">
                          {d.referenceNumber}
                        </td>
                        <td className="py-2 pr-3 font-mono text-[var(--cd-ink)]">
                          {d.orderNumber || "–"}
                        </td>
                        <td className="py-2 pr-3 text-[var(--cd-ink-soft)]">{d.retailer}</td>
                        <td className="py-2 pr-3 font-mono text-xs text-[var(--cd-ink-mute)]">
                          {d.poolSize} / {d.randomIndex}
                        </td>
                        <td className="py-2 text-xs text-[var(--cd-ink-mute)]">{d.drawnBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Gewinner-Enthüllung */}
      {phase === "reveal" && current ? (
        <div
          className="tc-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tc-winner-heading"
          data-testid="tc-winner"
        >
          {!reducedMotion ? <CardsConfetti /> : null}
          <div className="tc-winner">
            <div className="tc-winner-inner">
              <p className="text-center text-xs font-semibold tracking-[0.3em] text-[var(--cd-gold)] uppercase">
                Triple Chance · Ziehung {current.sequence} von {state.totalPrizes}
              </p>
              <h2
                id="tc-winner-heading"
                className="cd-display mt-2 text-center text-3xl font-bold text-[var(--cd-ink)] sm:text-4xl"
              >
                Gewinner-Los
              </h2>
              <p className="tc-winner-los mt-3 text-center" data-testid="tc-winner-los">
                {current.referenceNumber}
              </p>
              <p
                className="mt-1 text-center font-mono text-base text-[var(--cd-ink-soft)]"
                data-testid="tc-winner-order"
              >
                Bestellnummer {current.orderNumber || "–"} · {current.retailer}
              </p>
              <div className="mt-6 grid items-center gap-5 sm:grid-cols-[220px_1fr]">
                <div className="mx-auto w-full max-w-[220px]">{prizeVisuals[current.prizeId]}</div>
                <div>
                  <p className="text-xs font-semibold tracking-[0.22em] text-[var(--cd-ink-mute)] uppercase">
                    Gewinn
                  </p>
                  <p
                    className="cd-display mt-1 text-2xl font-semibold text-[var(--cd-gold)]"
                    data-testid="tc-winner-prize"
                  >
                    {current.prizeUnit}
                  </p>
                  <p className="mt-2 text-sm text-[var(--cd-ink-soft)]">
                    Gezogen aus {current.poolSize} Losen (Index {current.randomIndex}) am{" "}
                    {formatBerlin(current.drawnAt)} · protokolliert.
                  </p>
                </div>
              </div>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={closeReveal}
                  className="cd-btn-gold inline-flex min-h-[52px] items-center justify-center px-6 text-base font-semibold"
                  data-testid="tc-close"
                >
                  Weiter zur nächsten Ziehung
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
