"use client";

import { Download, Maximize2, Minimize2, RotateCcw, Trophy, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  drawCardsWinnerAction,
  markRemainingCardsNotWonAction,
  resetCardsDrawAction,
  undoLastCardsDrawAction,
} from "@/actions/cards-draw-actions";
import { CardsConfetti } from "@/components/cards/cards-confetti";
import { DrawSynth } from "@/components/draw/draw-sounds";
import type { CardsPrizeId } from "@/lib/cards-giveaway-config";
import type { CardsDrawState, DrawRecord, ReelItem } from "@/lib/cards-draw";
import { cn } from "@/lib/utils";

/**
 * Ziehungsbühne „Triple Chance“ (nur Admin): Countdown mit Trommelwirbel,
 * Lostrommel-Ticker, drei Walzen mit Anzeigename + Los-Nummer, die nacheinander
 * einrasten und alle auf dem Gewinner-Los stehen bleiben, Blitz, Lampen-Strobo,
 * Gewinnplakette, Fanfare, Applaus, Münzregen und die große Gewinnerkarte
 * (Vorname + Initial, Los-Nr., Bestellnummer, Gewinnbild), dazu die
 * Gewinner-Wand mit allen 17 Plätzen.
 *
 * Fairness: Der Gewinner wird VOR dem Walzenlauf serverseitig gezogen
 * (crypto.randomInt) und protokolliert – die Bühne zeigt nur das Ergebnis.
 */

const CELL = 96;
/** Zellen, die jede Walze bis zum Gewinner-Los durchläuft (dritte Walze am längsten) */
const TRAVEL = [64, 96, 136] as const;
const REEL_DURATIONS = [2400, 4000, 6800];
const COUNTDOWN_MS = 2900;
const WORLD_COLOR: Record<string, string> = {
  onepiece: "var(--cd-gold)",
  dragonball: "var(--cd-orange)",
  yugioh: "var(--cd-violet)",
  cardmarket: "var(--cd-cm-blue)",
};

type Phase = "idle" | "countdown" | "spinning" | "triple" | "reveal";

function easeOutQuint(p: number) {
  return 1 - Math.pow(1 - p, 5);
}

/**
 * Walzenstreifen: alle echten Lose aus dem Topf (je Walze anders gemischt),
 * dann das Gewinner-Los, danach zwei Füllzellen – keine erfundenen Namen.
 */
function buildStrip(
  winner: ReelItem,
  decoys: ReelItem[],
  travel: number,
  seed: number,
): ReelItem[] {
  const pool = decoys.filter((d) => d.referenceNumber !== winner.referenceNumber);
  const source = pool.length ? pool : [{ referenceNumber: "— — —", displayName: "" }];
  const mixed = [...source];
  let x = seed * 9301 + 49297;
  for (let i = mixed.length - 1; i > 0; i--) {
    x = (x * 9301 + 49297) % 233280;
    const j = x % (i + 1);
    [mixed[i], mixed[j]] = [mixed[j]!, mixed[i]!];
  }
  const strip: ReelItem[] = [];
  for (let i = 0; i < travel; i++) strip.push(mixed[i % mixed.length]!);
  strip.push(winner);
  for (let i = 0; i < 2; i++) strip.push(mixed[(travel + i) % mixed.length]!);
  return strip;
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
  prizeVisualsLarge,
  actor,
  exportHref,
}: {
  initialState: CardsDrawState;
  prizeVisuals: Record<CardsPrizeId, ReactNode>;
  prizeVisualsLarge: Record<CardsPrizeId, ReactNode>;
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
  const [symbols, setSymbols] = useState<ReelItem[][]>([[], [], []]);
  const [stopped, setStopped] = useState<boolean[]>([false, false, false]);
  const [countdownStep, setCountdownStep] = useState<number>(3);
  const [flash, setFlash] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [selectedPrize, setSelectedPrize] = useState<CardsPrizeId>(
    () =>
      [...initialState.prizes].reverse().find((p) => p.remaining > 0)?.id ??
      initialState.prizes[0]!.id,
  );

  const synth = useRef<DrawSynth | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stripRefs = useRef<Array<HTMLDivElement | null>>([null, null, null]);
  const pendingState = useRef<CardsDrawState | null>(null);
  const frame = useRef<number>(0);
  const timers = useRef<number[]>([]);

  if (!synth.current && typeof window !== "undefined") synth.current = new DrawSynth();

  useEffect(() => {
    try {
      if (window.localStorage.getItem("lze_draw_sound") === "0") setSoundOn(false);
    } catch {
      /* ohne Storage: Standard an */
    }
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    const pendingTimers = timers.current;
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
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
  const active = phase === "countdown" || phase === "spinning" || phase === "triple";
  const win = phase === "triple" || phase === "reveal";
  const nextSequence = Math.min(state.drawnTotal + 1, state.totalPrizes);

  const later = useCallback((fn: () => void, ms: number) => {
    const t = window.setTimeout(fn, ms);
    timers.current.push(t);
  }, []);

  const finishReveal = useCallback(() => {
    setPhase("reveal");
    synth.current?.whoosh();
    later(() => synth.current?.fanfare(), 250);
    later(() => synth.current?.applause(3200), 900);
    later(() => synth.current?.coins(22), 1300);
    if (pendingState.current) {
      setState(pendingState.current);
      pendingState.current = null;
    }
  }, [later]);

  const tripleThenReveal = useCallback(() => {
    setPhase("triple");
    synth.current?.stopSuspense();
    synth.current?.tripleChance();
    setFlash(true);
    later(() => setFlash(false), 420);
    const lampTicks = reducedMotion ? 0 : 14;
    for (let i = 0; i < lampTicks; i++) later(() => synth.current?.lamp(), i * 110);
    later(finishReveal, reducedMotion ? 400 : 2100);
  }, [finishReveal, later, reducedMotion]);

  /** Walzenlauf: alle drei Walzen landen auf dem Gewinner-Los (Mittelreihe). */
  const spinReels = useCallback(
    (reelSymbols: ReelItem[][]) => {
      const finals = reelSymbols.map((syms, i) => {
        const winnerIdx = TRAVEL[i] ?? syms.length - 3;
        return { L: syms.length, finalY: -(winnerIdx - 1) * CELL, startY: 0 };
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
            200 + i * 200,
          ),
        );
        later(tripleThenReveal, 900);
        return;
      }

      const t0 = performance.now();
      const starts = [0, 150, 300];
      const durations = REEL_DURATIONS.map((d) => d + Math.round(Math.random() * 200 - 100));
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
          const y = f.startY + (f.finalY - f.startY) * easeOutQuint(p);
          el.style.transform = `translate3d(0, ${y}px, 0)`;
          const cell = Math.floor(-y / CELL);
          if (cell !== lastCell[i] && now - lastTick[i]! > 36) {
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
          later(tripleThenReveal, 300);
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

    // Countdown läuft, während der Server zieht
    const countdownDone = new Promise<void>((resolve) => {
      if (reducedMotion) {
        resolve();
        return;
      }
      setCountdownStep(3);
      setPhase("countdown");
      synth.current?.drumroll(COUNTDOWN_MS);
      [3, 2, 1, 0].forEach((step, i) =>
        later(() => {
          setCountdownStep(step);
          synth.current?.countdown(step);
          if (step === 0) later(resolve, 350);
        }, i * 750),
      );
    });

    try {
      const [result] = await Promise.all([
        drawCardsWinnerAction({ prizeId: selected.id, onePrizePerPerson }),
        countdownDone,
      ]);
      if (!result.ok) {
        setState(result.state);
        setMessage({ kind: "error", text: result.error });
        synth.current?.error();
        setPhase("idle");
        return;
      }
      pendingState.current = result.state;
      setCurrent(result.draw);
      setStopped([false, false, false]);
      const winnerItem: ReelItem = {
        referenceNumber: result.draw.referenceNumber,
        displayName: result.draw.displayName,
      };
      const reelSymbols = [0, 1, 2].map((i) =>
        buildStrip(winnerItem, result.reelStrip, TRAVEL[i]!, i + 1),
      );
      setSymbols(reelSymbols);
      setPhase("spinning");
      requestAnimationFrame(() => spinReels(reelSymbols));
    } catch {
      setMessage({
        kind: "error",
        text: "Die Ziehung konnte nicht gestartet werden. Bitte erneut versuchen.",
      });
      synth.current?.error();
      setPhase("idle");
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
        `Letzte Ziehung verwerfen?\n\nZiehung ${last.sequence}: ${last.displayName}, Los ${last.referenceNumber} (${last.prizeUnit}) geht zurück in den Topf. Dieser Schritt wird protokolliert.`,
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

  async function resetAll() {
    if (phase !== "idle" || busy || state.draws.length === 0) return;
    const typed = window.prompt(
      `ALLE ${state.draws.length} Ziehungen zurücksetzen? Alle Gewinner-Lose gehen zurück in den Topf, das Protokoll wird geleert (die verworfenen Ziehungen bleiben im Audit-Log).\n\nZur Bestätigung ZURÜCKSETZEN eingeben:`,
    );
    if (typed !== "ZURÜCKSETZEN") return;
    setBusy(true);
    try {
      const result = await resetCardsDrawAction();
      setState(result.state);
      setMessage(
        result.ok
          ? {
              kind: "info",
              text: `${result.count} Ziehungen zurückgesetzt – alle Lose sind wieder im Topf.`,
            }
          : { kind: "error", text: result.error },
      );
      if (result.ok) {
        const first = [...result.state.prizes].reverse().find((p) => p.remaining > 0);
        if (first) setSelectedPrize(first.id);
      }
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

  function toggleFullscreen() {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }

  const reelCells = symbols;

  /** Lostrommel-Ticker: Namen aus dem Topf, mehrfach wiederholt */
  const tickerItems = useMemo(() => {
    const names = state.lots
      .filter((l) => l.status !== "INVALID" && l.status !== "NOT_WON")
      .map((l) => `${l.displayName} · ${l.referenceNumber}`);
    if (names.length === 0) return ["Keine Lose im Topf"];
    const out: string[] = [];
    while (out.length < 40) out.push(...names);
    return out.slice(0, 40);
  }, [state.lots]);

  /** Gewinner-Wand: je Gewinnkategorie alle Plätze, gefüllt in Ziehungsreihenfolge */
  const wall = useMemo(
    () =>
      state.prizes.map((p) => ({
        prize: p,
        slots: Array.from({ length: p.total }, (_, k) => {
          const winners = state.draws.filter((d) => d.prizeId === p.id);
          return winners[k] ?? null;
        }),
      })),
    [state.prizes, state.draws],
  );

  const particles = useMemo(
    () =>
      current
        ? Array.from({ length: 36 }, (_, i) => ({
            left: `${(i * 37) % 100}%`,
            delay: `${(i % 9) * 0.18}s`,
            size: 10 + ((i * 7) % 12),
            hue: i % 3,
          }))
        : [],
    [current],
  );

  return (
    <div className="tc-page cards-theme min-h-screen" data-phase={phase}>
      <header className="tc-topbar">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
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
            <Link href="/admin/gewinnspiel?campaign=cards_2026" className="tc-navbtn">
              Admin · Teilnahmen
            </Link>
            <Link href="/gewinner-cards/lose" className="tc-navbtn" data-testid="tc-lots-link">
              Lose verwalten
            </Link>
            <a href={exportHref} className="tc-navbtn">
              <Download className="h-4 w-4" aria-hidden="true" />
              Gewinner-CSV
            </a>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="tc-navbtn"
              aria-pressed={fullscreen}
            >
              {fullscreen ? (
                <Minimize2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
              )}
              {fullscreen ? "Bühne verlassen" : "Bühne (Vollbild)"}
            </button>
            <button
              type="button"
              onClick={() => {
                synth.current?.unlock();
                setSoundOn((v) => !v);
              }}
              aria-pressed={soundOn}
              className="tc-navbtn"
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

      <main className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)] lg:py-8">
        {/* Bühne */}
        <div
          ref={stageRef}
          className="tc-stage"
          data-active={active ? "1" : "0"}
          data-win={win ? "1" : "0"}
        >
          <div className="tc-beams" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="tc-stars" aria-hidden="true" />

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
                Cards-Gewinnspiel · Ziehung {nextSequence} von {state.totalPrizes}
              </p>
            </div>

            {/* Es geht um … */}
            <div className="tc-spot">
              <div
                className="tc-spot-visual"
                style={{ ["--tc-world" as string]: WORLD_COLOR[selected.world] }}
              >
                {prizeVisuals[selected.id]}
              </div>
              <div className="tc-spot-text">
                <p className="tc-spot-kicker">Es geht um</p>
                <p className="tc-spot-title" data-testid="tc-spot-title">
                  {selected.unit}
                </p>
                <p className="tc-spot-sub">
                  {selected.remaining} von {selected.total} noch zu vergeben · {state.poolSize} Lose
                  im Topf
                </p>
              </div>
            </div>

            {/* Lostrommel */}
            <div
              className="tc-ticker"
              aria-hidden="true"
              data-run={phase === "spinning" || phase === "countdown" ? "1" : "0"}
            >
              <div className="tc-ticker-track">
                {tickerItems.map((t, i) => (
                  <span key={i}>{t}</span>
                ))}
              </div>
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
                              <span className="tc-cell-ref">{k === 1 ? "READY" : "· · ·"}</span>
                            </div>
                          ))
                        : reelCells[i]!.map((sym, k) => {
                            const isWinnerCell = k === TRAVEL[i];
                            return (
                              <div
                                key={k}
                                className={cn("tc-cell", isWinnerCell && win && "tc-cell--win")}
                                data-winner={isWinnerCell ? "1" : undefined}
                              >
                                <span className="tc-cell-name">{sym.displayName}</span>
                                <span className="tc-cell-ref">{sym.referenceNumber}</span>
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
                {phase === "countdown" ? (
                  <div className="tc-countdown" aria-hidden="true">
                    <span key={countdownStep}>{countdownStep > 0 ? countdownStep : "LOS!"}</span>
                  </div>
                ) : null}
                {phase === "spinning" && stopped[1] && !stopped[2] ? (
                  <p className="tc-suspense" aria-hidden="true">
                    Noch eine Walze …
                  </p>
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
                {phase === "countdown"
                  ? "Achtung …"
                  : phase === "spinning" || phase === "triple"
                    ? "Walzen laufen"
                    : busy
                      ? "Bitte warten …"
                      : "Start"}
              </button>
            </div>

            <p className="px-3 pb-3 text-center text-xs text-[var(--cd-ink-mute)] sm:px-6">
              Jede Bestellnummer ist ein Los · ein Los gewinnt höchstens einmal · der Zufall wird
              serverseitig entschieden und protokolliert.
            </p>
            {flash ? <div className="tc-flash" aria-hidden="true" /> : null}

            {/* Gewinner-Enthüllung – im Automatenfenster, weil nur dieser Bereich gestreamt wird */}
            {phase === "reveal" && current ? (
              <div
                className="tc-overlay"
                role="dialog"
                aria-modal="true"
                aria-labelledby="tc-winner-heading"
                data-testid="tc-winner"
              >
                {!reducedMotion ? <CardsConfetti /> : null}
                <div className="tc-rays" aria-hidden="true" />
                {!reducedMotion ? (
                  <div className="tc-coins" aria-hidden="true">
                    {particles.map((p, i) => (
                      <i
                        key={i}
                        style={{
                          left: p.left,
                          animationDelay: p.delay,
                          width: p.size,
                          height: p.size,
                        }}
                        data-hue={p.hue}
                      />
                    ))}
                  </div>
                ) : null}
                <div className="tc-winner">
                  <div className="tc-winner-inner">
                    <p className="tc-winner-kicker">
                      Triple Chance · Ziehung {current.sequence} von {state.totalPrizes}
                    </p>
                    <p className="tc-winner-name" data-testid="tc-winner-name">
                      {current.displayName}
                    </p>
                    <p className="tc-winner-gewinnt">gewinnt</p>
                    <div className="tc-winner-prize">
                      <div
                        className="tc-winner-visual"
                        style={{ ["--tc-world" as string]: WORLD_COLOR[current.world] }}
                      >
                        {prizeVisualsLarge[current.prizeId]}
                      </div>
                      <div>
                        <p className="tc-winner-prize-title" data-testid="tc-winner-prize">
                          {current.prizeUnit}
                        </p>
                        <p className="tc-winner-los" data-testid="tc-winner-los">
                          {current.referenceNumber}
                        </p>
                        <p className="tc-winner-order" data-testid="tc-winner-order">
                          Bestellnummer {current.orderNumber || "–"} · {current.retailer}
                        </p>
                        <p className="tc-winner-meta">
                          Gezogen aus {current.poolSize} Losen (Index {current.randomIndex}) am{" "}
                          {formatBerlin(current.drawnAt)} · protokolliert
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closeReveal}
                      className="cd-btn-gold tc-winner-btn"
                      data-testid="tc-close"
                    >
                      Weiter
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          {/* Gewinner-Wand */}
          <section className="tc-wall" aria-labelledby="tc-wall-heading">
            <h2 id="tc-wall-heading" className="tc-wall-title">
              Gewinner-Wand · {state.drawnTotal} von {state.totalPrizes}
            </h2>
            <div className="tc-wall-grid">
              {wall.map(({ prize, slots }) => (
                <div
                  key={prize.id}
                  className="tc-wall-group"
                  style={{ ["--tc-world" as string]: WORLD_COLOR[prize.world] }}
                >
                  <p className="tc-wall-group-title">{prize.headline}</p>
                  <div className="tc-wall-slots">
                    {slots.map((d, k) => (
                      <div
                        key={k}
                        className={cn("tc-wall-slot", d && "tc-wall-slot--won")}
                        data-testid={d ? "tc-wall-won" : "tc-wall-open"}
                      >
                        {d ? (
                          <>
                            <span className="tc-wall-name">{d.displayName}</span>
                            <span className="tc-wall-ref">{d.referenceNumber}</span>
                          </>
                        ) : (
                          <span className="tc-wall-q">?</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Seitenleiste */}
        <aside className="space-y-4">
          <div className="cd-holo rounded-2xl bg-[var(--cd-surface)] p-4 sm:p-5">
            <h2 className="cd-display text-lg font-semibold text-[var(--cd-ink)]">Gewinnleiter</h2>
            <p className="mt-1 text-xs text-[var(--cd-ink-mute)]">
              Kategorie wählen, dann Start. Empfohlen von unten nach oben – der Hauptgewinn zuletzt.
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
                <dt className="text-[var(--cd-ink-mute)]">Personen</dt>
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
                className="tc-navbtn disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="tc-undo"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Letzte Ziehung verwerfen
              </button>
              <button
                type="button"
                onClick={resetAll}
                disabled={phase !== "idle" || busy || state.draws.length === 0}
                className="tc-navbtn tc-navbtn--danger disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="tc-reset"
              >
                Ziehung komplett zurücksetzen
              </button>
              {state.remainingTotal === 0 && state.poolSize > 0 ? (
                <button
                  type="button"
                  onClick={markNotWon}
                  disabled={phase !== "idle" || busy}
                  className="tc-navbtn disabled:opacity-50"
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
                data-testid="tc-message"
              >
                {message.text}
              </p>
            ) : null}
          </div>

          {/* Personen im Topf */}
          <div className="rounded-2xl border border-[var(--cd-border-soft)] bg-[var(--cd-surface)] p-4 sm:p-5">
            <h2 className="cd-display text-lg font-semibold text-[var(--cd-ink)]">
              Lose je Person
            </h2>
            <p className="mt-1 text-xs text-[var(--cd-ink-mute)]">
              Jedes Los zählt gleich – wer mehr Lose hat, hat entsprechend mehr Chancen.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm" data-testid="tc-people">
              {state.people.map((person) => (
                <li key={person.displayName + person.lots} className="flex items-center gap-2">
                  <span className="w-28 shrink-0 truncate text-[var(--cd-ink)]">
                    {person.displayName}
                  </span>
                  <span className="tc-bar">
                    <i
                      style={{
                        width: `${Math.max(4, (person.lots / Math.max(1, state.people[0]?.lots ?? 1)) * 100)}%`,
                      }}
                    />
                  </span>
                  <span className="w-20 shrink-0 text-right text-xs text-[var(--cd-ink-mute)]">
                    {person.lots} {person.lots === 1 ? "Los" : "Lose"}
                    {person.wins ? ` · ${person.wins} 🏆` : ""}
                  </span>
                </li>
              ))}
            </ul>
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
                <table className="w-full min-w-[820px] text-left text-sm" data-testid="tc-protocol">
                  <thead className="text-xs tracking-wider text-[var(--cd-ink-mute)] uppercase">
                    <tr>
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">Zeit</th>
                      <th className="py-2 pr-3">Gewinn</th>
                      <th className="py-2 pr-3">Name</th>
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
                        <td className="py-2 pr-3 font-semibold text-[var(--cd-ink)]">
                          {d.displayName}
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
    </div>
  );
}
