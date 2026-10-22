import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import { Prisma, type SweepstakesEntryStatus } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import {
  CARDS_CAMPAIGN_ID,
  CARDS_PRIZES,
  type CardsPrize,
  type CardsPrizeId,
  type CardsWorld,
} from "@/lib/cards-giveaway-config";
import { prisma } from "@/lib/db";
import { retailerLabel } from "@/lib/gewinnspiel-config";
import { logger } from "@/lib/logger";
import { decryptOrderNumber } from "@/lib/sweepstakes-crypto";

/**
 * Gewinnziehung des Cards-Gewinnspiels (Kampagne cards_2026) – Serverlogik.
 *
 * Regeln des Veranstalters (22.10.2026):
 * - Jede gültige Teilnahme (Bestellnummer) ist genau EIN Los. Wer 20-mal
 *   teilgenommen hat, liegt 20-mal im Topf.
 * - Ein Los gewinnt höchstens einmal (es verlässt nach dem Gewinn den Topf).
 *   Eine Person kann über weitere Lose weitere Gewinne erhalten; optional kann
 *   der Admin pro Sitzung „höchstens ein Gewinn je Person (E-Mail)“ zuschalten.
 * - Zufall: crypto.randomInt über die aktuelle Topfgröße; Index und Topfgröße
 *   werden protokolliert. Die Ziehung ist serverseitig entschieden, bevor die
 *   Walzen laufen – die Animation ist Präsentation.
 * - Kampagnenrein: nur Lose mit campaignId = cards_2026, nur Cards-Gewinne.
 */

export const DRAW_POOL_STATUSES: SweepstakesEntryStatus[] = ["RECEIVED", "IN_REVIEW", "REVIEWED"];

export interface DrawPrizeState {
  id: CardsPrizeId;
  world: CardsWorld;
  headline: string;
  unit: string;
  total: number;
  drawn: number;
  remaining: number;
}

export interface DrawRecord {
  id: string;
  sequence: number;
  prizeId: CardsPrizeId;
  prizeUnit: string;
  prizeHeadline: string;
  world: CardsWorld;
  entryId: string;
  referenceNumber: string;
  orderNumber: string;
  retailer: string;
  poolSize: number;
  randomIndex: number;
  drawnBy: string;
  drawnAt: string;
}

export interface CardsDrawState {
  campaignId: typeof CARDS_CAMPAIGN_ID;
  /** Lose, die aktuell gezogen werden können */
  poolSize: number;
  /** Alle gültigen Lose (inkl. bereits gezogener) */
  validLose: number;
  /** Verschiedene Personen (E-Mail) im gültigen Lostopf */
  participants: number;
  prizes: DrawPrizeState[];
  totalPrizes: number;
  drawnTotal: number;
  remainingTotal: number;
  draws: DrawRecord[];
  notWonMarked: number;
}

export type DrawOutcome =
  | { ok: true; draw: DrawRecord; reelStrip: string[]; state: CardsDrawState }
  | { ok: false; error: string; state: CardsDrawState };

class DrawError extends Error {}

function prizeById(prizeId: unknown): CardsPrize | null {
  return CARDS_PRIZES.find((p) => p.id === prizeId) ?? null;
}

function toRecord(
  draw: {
    id: string;
    sequence: number;
    prizeId: string;
    entryId: string;
    poolSize: number;
    randomIndex: number;
    drawnBy: string;
    drawnAt: Date;
  },
  entry: {
    referenceNumber: string;
    orderNumberEncrypted: string;
    retailer: string;
    retailerOther: string | null;
    status: SweepstakesEntryStatus;
  },
): DrawRecord {
  const prize = prizeById(draw.prizeId);
  return {
    id: draw.id,
    sequence: draw.sequence,
    prizeId: (prize?.id ?? "cardmarket_100") as CardsPrizeId,
    prizeUnit: prize?.unit ?? draw.prizeId,
    prizeHeadline: prize?.headline ?? draw.prizeId,
    world: prize?.world ?? "cardmarket",
    entryId: draw.entryId,
    referenceNumber: entry.referenceNumber,
    orderNumber:
      entry.status === "DELETED" ? "" : (decryptOrderNumber(entry.orderNumberEncrypted) ?? ""),
    retailer: retailerLabel(entry.retailer, entry.retailerOther),
    poolSize: draw.poolSize,
    randomIndex: draw.randomIndex,
    drawnBy: draw.drawnBy,
    drawnAt: draw.drawnAt.toISOString(),
  };
}

export async function getCardsDrawState(): Promise<CardsDrawState> {
  const campaignId = CARDS_CAMPAIGN_ID;
  const [poolSize, validLose, participantRows, draws, notWonMarked] = await Promise.all([
    prisma.sweepstakesEntry.count({ where: { campaignId, status: { in: DRAW_POOL_STATUSES } } }),
    prisma.sweepstakesEntry.count({
      where: { campaignId, status: { in: [...DRAW_POOL_STATUSES, "WINNER", "NOT_WON"] } },
    }),
    prisma.sweepstakesEntry.findMany({
      where: { campaignId, status: { in: [...DRAW_POOL_STATUSES, "WINNER", "NOT_WON"] } },
      distinct: ["email"],
      select: { email: true },
    }),
    prisma.sweepstakesDraw.findMany({
      where: { campaignId },
      orderBy: { sequence: "asc" },
      include: {
        entry: {
          select: {
            referenceNumber: true,
            orderNumberEncrypted: true,
            retailer: true,
            retailerOther: true,
            status: true,
          },
        },
      },
    }),
    prisma.sweepstakesEntry.count({ where: { campaignId, status: "NOT_WON" } }),
  ]);
  const drawnByPrize = new Map<string, number>();
  for (const d of draws) drawnByPrize.set(d.prizeId, (drawnByPrize.get(d.prizeId) ?? 0) + 1);
  const prizes: DrawPrizeState[] = CARDS_PRIZES.map((p) => {
    const drawn = drawnByPrize.get(p.id) ?? 0;
    return {
      id: p.id,
      world: p.world,
      headline: p.headline,
      unit: p.unit,
      total: p.count,
      drawn,
      remaining: Math.max(0, p.count - drawn),
    };
  });
  const totalPrizes = prizes.reduce((s, p) => s + p.total, 0);
  const drawnTotal = prizes.reduce((s, p) => s + p.drawn, 0);
  return {
    campaignId,
    poolSize,
    validLose,
    participants: participantRows.filter((r) => r.email).length,
    prizes,
    totalPrizes,
    drawnTotal,
    remainingTotal: totalPrizes - drawnTotal,
    draws: draws.map((d) => toRecord(d, d.entry)),
    notWonMarked,
  };
}

/** Zufällige Los-Nummern aus dem Topf für die Walzenoptik (keine Personendaten). */
async function reelStrip(excludeEntryId: string, size = 30): Promise<string[]> {
  const rows = await prisma.sweepstakesEntry.findMany({
    where: {
      campaignId: CARDS_CAMPAIGN_ID,
      status: { in: [...DRAW_POOL_STATUSES, "WINNER"] },
      id: { not: excludeEntryId },
    },
    select: { referenceNumber: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const refs = rows.map((r) => r.referenceNumber);
  // Fisher-Yates mit crypto.randomInt
  for (let i = refs.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [refs[i], refs[j]] = [refs[j]!, refs[i]!];
  }
  return refs.slice(0, size);
}

export async function drawCardsWinner(input: {
  prizeId: string;
  actor: string;
  onePrizePerPerson?: boolean;
}): Promise<DrawOutcome> {
  const campaignId = CARDS_CAMPAIGN_ID;
  const prize = prizeById(input.prizeId);
  if (!prize) {
    return {
      ok: false,
      error: "Unbekannter Gewinn für die Cards-Kampagne.",
      state: await getCardsDrawState(),
    };
  }
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const drawnForPrize = await tx.sweepstakesDraw.count({
          where: { campaignId, prizeId: prize.id },
        });
        if (drawnForPrize >= prize.count) {
          throw new DrawError(`Alle ${prize.count} Gewinne „${prize.unit}“ sind bereits gezogen.`);
        }
        let excludedEmails: string[] = [];
        if (input.onePrizePerPerson) {
          const winners = await tx.sweepstakesEntry.findMany({
            where: { campaignId, status: "WINNER", email: { not: "" } },
            select: { email: true },
            distinct: ["email"],
          });
          excludedEmails = winners.map((w) => w.email);
        }
        const where: Prisma.SweepstakesEntryWhereInput = {
          campaignId,
          status: { in: DRAW_POOL_STATUSES },
          ...(excludedEmails.length ? { email: { notIn: excludedEmails } } : {}),
        };
        const poolSize = await tx.sweepstakesEntry.count({ where });
        if (poolSize === 0) {
          throw new DrawError(
            input.onePrizePerPerson
              ? "Keine Lose mehr im Topf (alle verbleibenden Lose gehören bereits zu Gewinnern)."
              : "Keine Lose mehr im Topf.",
          );
        }
        const randomIndex = randomInt(poolSize);
        const [picked] = await tx.sweepstakesEntry.findMany({
          where,
          orderBy: { id: "asc" },
          skip: randomIndex,
          take: 1,
          select: {
            id: true,
            status: true,
            referenceNumber: true,
            orderNumberEncrypted: true,
            retailer: true,
            retailerOther: true,
          },
        });
        if (!picked) throw new DrawError("Ziehung fehlgeschlagen – bitte erneut starten.");
        const updated = await tx.sweepstakesEntry.updateMany({
          where: { id: picked.id, campaignId, status: { in: DRAW_POOL_STATUSES } },
          data: { status: "WINNER", prizeId: prize.id },
        });
        if (updated.count !== 1) {
          throw new DrawError("Das Los wurde zeitgleich verändert – bitte erneut ziehen.");
        }
        const last = await tx.sweepstakesDraw.aggregate({
          where: { campaignId },
          _max: { sequence: true },
        });
        const draw = await tx.sweepstakesDraw.create({
          data: {
            id: randomUUID(),
            campaignId,
            prizeId: prize.id,
            sequence: (last._max.sequence ?? 0) + 1,
            entryId: picked.id,
            previousStatus: picked.status,
            poolSize,
            randomIndex,
            drawnBy: input.actor,
          },
        });
        return { draw, picked };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await writeAuditLog({
      actor: input.actor,
      action: "sweepstakes.draw",
      entityType: "SweepstakesEntry",
      entityId: result.picked.id,
      changes: {
        campaign: campaignId,
        prize: prize.id,
        sequence: result.draw.sequence,
        reference: result.picked.referenceNumber,
        poolSize: result.draw.poolSize,
        randomIndex: result.draw.randomIndex,
        onePrizePerPerson: Boolean(input.onePrizePerPerson),
      },
    });
    logger.info("sweepstakes.draw", {
      campaign: campaignId,
      prize: prize.id,
      sequence: result.draw.sequence,
      reference: result.picked.referenceNumber,
    });

    const [strip, state] = await Promise.all([reelStrip(result.picked.id), getCardsDrawState()]);
    return {
      ok: true,
      draw: toRecord(result.draw, { ...result.picked, status: "WINNER" }),
      reelStrip: strip,
      state,
    };
  } catch (error) {
    const message =
      error instanceof DrawError
        ? error.message
        : error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034"
          ? "Zwei Ziehungen gleichzeitig – bitte erneut starten."
          : "Die Ziehung konnte nicht gespeichert werden. Bitte erneut versuchen.";
    if (!(error instanceof DrawError)) {
      logger.error("sweepstakes.draw_failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
    }
    return { ok: false, error: message, state: await getCardsDrawState() };
  }
}

/** Letzte Ziehung verwerfen: Los zurück in den Topf (vorheriger Status), Protokolleintrag entfernen. */
export async function undoLastCardsDraw(
  actor: string,
): Promise<
  | { ok: true; undone: DrawRecord; state: CardsDrawState }
  | { ok: false; error: string; state: CardsDrawState }
> {
  const campaignId = CARDS_CAMPAIGN_ID;
  try {
    const undone = await prisma.$transaction(
      async (tx) => {
        const last = await tx.sweepstakesDraw.findFirst({
          where: { campaignId },
          orderBy: { sequence: "desc" },
          include: {
            entry: {
              select: {
                referenceNumber: true,
                orderNumberEncrypted: true,
                retailer: true,
                retailerOther: true,
                status: true,
              },
            },
          },
        });
        if (!last) throw new DrawError("Es gibt keine Ziehung, die verworfen werden könnte.");
        await tx.sweepstakesEntry.update({
          where: { id: last.entryId, campaignId },
          data: { status: last.previousStatus, prizeId: null },
        });
        await tx.sweepstakesDraw.delete({ where: { id: last.id } });
        return last;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    await writeAuditLog({
      actor,
      action: "sweepstakes.draw_undo",
      entityType: "SweepstakesEntry",
      entityId: undone.entryId,
      changes: {
        campaign: campaignId,
        prize: undone.prizeId,
        sequence: undone.sequence,
        reference: undone.entry.referenceNumber,
      },
    });
    return {
      ok: true,
      undone: toRecord(undone, { ...undone.entry, status: undone.previousStatus }),
      state: await getCardsDrawState(),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof DrawError
          ? error.message
          : "Die Ziehung konnte nicht verworfen werden. Bitte erneut versuchen.",
      state: await getCardsDrawState(),
    };
  }
}

/** Nach vollständiger Ziehung: alle verbliebenen Lose als „Nicht gewonnen“ markieren. */
export async function markRemainingCardsNotWon(
  actor: string,
): Promise<
  | { ok: true; count: number; state: CardsDrawState }
  | { ok: false; error: string; state: CardsDrawState }
> {
  const state = await getCardsDrawState();
  if (state.remainingTotal > 0) {
    return {
      ok: false,
      error: `Es sind noch ${state.remainingTotal} Gewinne zu ziehen – erst danach können die restlichen Lose markiert werden.`,
      state,
    };
  }
  const result = await prisma.sweepstakesEntry.updateMany({
    where: { campaignId: CARDS_CAMPAIGN_ID, status: { in: DRAW_POOL_STATUSES } },
    data: { status: "NOT_WON" },
  });
  await writeAuditLog({
    actor,
    action: "sweepstakes.mark_not_won",
    entityType: "SweepstakesEntry",
    changes: { campaign: CARDS_CAMPAIGN_ID, count: result.count },
  });
  return { ok: true, count: result.count, state: await getCardsDrawState() };
}
