"use server";

import { requireRoleOrThrow } from "@/lib/auth";
import {
  type CardsDrawState,
  drawCardsWinner,
  type DrawOutcome,
  getCardsDrawState,
  markRemainingCardsNotWon,
  resetCardsDraw,
  setCardsLotExcluded,
  undoLastCardsDraw,
} from "@/lib/cards-draw";

/**
 * Server Actions der Cards-Gewinnziehung (/gewinner-cards) – ausschließlich
 * ADMIN. Die Entscheidung fällt serverseitig (crypto.randomInt), die Walzen
 * im Browser zeigen das Ergebnis nur an.
 */

export async function drawCardsWinnerAction(input: {
  prizeId: string;
  onePrizePerPerson: boolean;
}): Promise<DrawOutcome> {
  const session = await requireRoleOrThrow("ADMIN");
  return drawCardsWinner({
    prizeId: String(input.prizeId),
    onePrizePerPerson: Boolean(input.onePrizePerPerson),
    actor: session.email,
  });
}

export async function undoLastCardsDrawAction(): Promise<
  | { ok: true; state: CardsDrawState; reference: string }
  | { ok: false; error: string; state: CardsDrawState }
> {
  const session = await requireRoleOrThrow("ADMIN");
  const result = await undoLastCardsDraw(session.email);
  if (!result.ok) return result;
  return { ok: true, state: result.state, reference: result.undone.referenceNumber };
}

export async function markRemainingCardsNotWonAction(): Promise<
  | { ok: true; count: number; state: CardsDrawState }
  | { ok: false; error: string; state: CardsDrawState }
> {
  const session = await requireRoleOrThrow("ADMIN");
  return markRemainingCardsNotWon(session.email);
}

export async function refreshCardsDrawStateAction(): Promise<CardsDrawState> {
  await requireRoleOrThrow("ADMIN");
  return getCardsDrawState();
}

export async function resetCardsDrawAction(): Promise<
  | { ok: true; count: number; state: CardsDrawState }
  | { ok: false; error: string; state: CardsDrawState }
> {
  const session = await requireRoleOrThrow("ADMIN");
  return resetCardsDraw(session.email);
}

export async function setCardsLotExcludedAction(input: {
  entryId: string;
  excluded: boolean;
}): Promise<
  | { ok: true; referenceNumber: string; state: CardsDrawState }
  | { ok: false; error: string; state: CardsDrawState }
> {
  const session = await requireRoleOrThrow("ADMIN");
  return setCardsLotExcluded({
    entryId: String(input.entryId),
    excluded: Boolean(input.excluded),
    actor: session.email,
  });
}
