import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isRetailerId, MAX_FORM_HOURS, MIN_FORM_SECONDS } from "@/lib/gewinnspiel-config";
import {
  GUTSCHEIN_CODE_PATTERN,
  GUTSCHEIN_RATE_LIMIT,
  GUTSCHEIN_TERMS_VERSION,
} from "@/lib/gutschein-config";
import { logger } from "@/lib/logger";
import {
  encryptOrderNumber,
  hashEmailForVoucher,
  hashOrderNumber,
  verifyFormToken,
} from "@/lib/sweepstakes-crypto";
import { normalizeEmail, normalizeOrderNumber } from "@/lib/sweepstakes-validation";

/**
 * Kernlogik der Gutscheinaktion – getrennt von der Server Action, damit sie
 * in Integrationstests ohne Next-Request-Kontext läuft.
 *
 * Vergabe ist atomar: Innerhalb einer Transaktion wird der älteste freie
 * Code mit FOR UPDATE SKIP LOCKED reserviert und sofort mit der Einlösung
 * verknüpft – auch bei parallelen Anfragen bekommt jede Bestellung genau
 * einen Code und kein Code wird doppelt vergeben.
 */

export interface VoucherSubmitContext {
  submissionIdentifier: string | null;
  honeypot: string | null;
  formToken: string | null;
  utm: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    content: string | null;
    term: string | null;
  };
  referrer: string | null;
  landingHost: string | null;
  now?: Date;
}

export type VoucherResult =
  | { ok: true; code: string; alreadyIssued: boolean }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; soldOut?: boolean };

const FIELD_ERROR = "Bitte prüfe die markierten Felder.";
const DUPLICATE_MESSAGE =
  "Für diese Bestellnummer wurde bereits ein Gutschein ausgestellt. Wenn du ihn verloren hast, trage bitte dieselbe E-Mail-Adresse wie bei der ersten Anforderung ein – dann zeigen wir ihn dir erneut.";
const SOLD_OUT_MESSAGE =
  "Alle Gutscheine dieser Aktion sind bereits vergeben. Vielen Dank für dein Interesse!";
const GENERIC_ERROR =
  "Dein Gutschein konnte gerade nicht ausgestellt werden. Bitte versuche es in einem Moment erneut.";

const nameField = (label: string) =>
  z
    .string({ message: `Bitte ${label} angeben.` })
    .trim()
    .min(1, `Bitte ${label} angeben.`)
    .max(100, `${label} ist zu lang.`);

export const voucherInputSchema = z.object({
  retailer: z.string().min(1, "Bitte einen Händler auswählen."),
  retailerOther: z.string().trim().max(120, "Der Händlername ist zu lang.").optional(),
  orderNumber: z
    .string({ message: "Bitte die Bestellnummer angeben." })
    .trim()
    .min(1, "Bitte die Bestellnummer angeben."),
  firstName: nameField("deinen Vornamen"),
  lastName: nameField("deinen Nachnamen"),
  email: z
    .string({ message: "Bitte deine E-Mail-Adresse angeben." })
    .trim()
    .toLowerCase()
    .email("Bitte eine gültige E-Mail-Adresse angeben.")
    .max(200, "Die E-Mail-Adresse ist zu lang."),
  consent: z.literal(true, {
    errorMap: () => ({
      message:
        "Bitte bestätige deine Angaben, die Aktionsbedingungen und die Kenntnisnahme der Datenschutzhinweise.",
    }),
  }),
});

function trimOrNull(value: unknown, max = 300): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  return v.slice(0, max);
}

/** Bots erhalten einen plausibel aussehenden, aber wertlosen Code. */
function decoyCode(): string {
  return `C${randomBytes(4).toString("hex").toUpperCase().slice(0, 7)}`;
}

export async function redeemVoucher(
  rawInput: Record<string, unknown>,
  ctx: VoucherSubmitContext,
): Promise<VoucherResult> {
  const now = ctx.now ?? new Date();

  // 1) Honeypot: still "erfolgreich", aber ohne echten Code zu verbrauchen
  if (ctx.honeypot && ctx.honeypot.trim().length > 0) {
    logger.warn("voucher.honeypot_tripped", {});
    return { ok: true, code: decoyCode(), alreadyIssued: false };
  }

  // 2) Formular-Token (Mindest-/Höchstalter)
  const tokenOk = verifyFormToken(
    ctx.formToken,
    MIN_FORM_SECONDS * 1000,
    MAX_FORM_HOURS * 60 * 60 * 1000,
    now.getTime(),
  );
  if (!tokenOk) {
    return {
      ok: false,
      error:
        "Das Formular war zu schnell oder zu lange geöffnet. Bitte lade die Seite neu und sende es erneut ab.",
    };
  }

  // 3) Rate Limiting pro Client-Kennung
  if (ctx.submissionIdentifier) {
    const windowStart = new Date(now.getTime() - GUTSCHEIN_RATE_LIMIT.windowMinutes * 60 * 1000);
    const recent = await prisma.voucherRedemption.count({
      where: { submissionIdentifier: ctx.submissionIdentifier, createdAt: { gte: windowStart } },
    });
    if (recent >= GUTSCHEIN_RATE_LIMIT.maxPerWindow) {
      logger.warn("voucher.rate_limited", {});
      return {
        ok: false,
        error: "Zu viele Anfragen in kurzer Zeit. Bitte versuche es später erneut.",
      };
    }
  }

  // 4) Feldvalidierung
  const parsed = voucherInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: FIELD_ERROR, fieldErrors };
  }
  const input = parsed.data;
  if (!isRetailerId(input.retailer)) {
    return { ok: false, error: FIELD_ERROR, fieldErrors: { retailer: "Bitte einen gültigen Händler auswählen." } };
  }
  if (input.retailer === "other" && !input.retailerOther) {
    return { ok: false, error: FIELD_ERROR, fieldErrors: { retailerOther: "Bitte den Namen des Händlers angeben." } };
  }
  const order = normalizeOrderNumber(input.orderNumber);
  if (!order.ok) {
    return { ok: false, error: FIELD_ERROR, fieldErrors: { orderNumber: order.error ?? "Ungültige Bestellnummer." } };
  }

  const orderHash = hashOrderNumber(order.value);
  const emailHash = hashEmailForVoucher(normalizeEmail(input.email));

  // 5) Wiedervorlage: dieselbe Bestellung + dieselbe E-Mail → Code erneut zeigen
  const existing = await prisma.voucherRedemption.findUnique({
    where: { orderNumberHash: orderHash },
    select: { emailHash: true, voucherCode: { select: { code: true } } },
  });
  if (existing) {
    if (existing.emailHash === emailHash) {
      return { ok: true, code: existing.voucherCode.code, alreadyIssued: true };
    }
    return { ok: false, error: DUPLICATE_MESSAGE, fieldErrors: { orderNumber: DUPLICATE_MESSAGE } };
  }

  // 6) Atomare Vergabe des ältesten freien Codes
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const free = await tx.$queryRaw<Array<{ id: string; code: string }>>`
          SELECT vc."id", vc."code"
          FROM "VoucherCode" vc
          WHERE NOT EXISTS (
            SELECT 1 FROM "VoucherRedemption" r WHERE r."voucherCodeId" = vc."id"
          )
          ORDER BY vc."importedAt" ASC, vc."code" ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        `;
        const picked = free[0];
        if (!picked) return null;
        await tx.voucherRedemption.create({
          data: {
            id: randomUUID(),
            voucherCodeId: picked.id,
            retailer: input.retailer,
            retailerOther: input.retailer === "other" ? (input.retailerOther ?? null) : null,
            orderNumberHash: orderHash,
            orderNumberEncrypted: encryptOrderNumber(input.orderNumber.trim()),
            emailHash,
            firstName: input.firstName,
            lastName: input.lastName,
            email: normalizeEmail(input.email),
            acceptedTermsAt: now,
            termsVersion: GUTSCHEIN_TERMS_VERSION,
            utmSource: trimOrNull(ctx.utm.source, 120),
            utmMedium: trimOrNull(ctx.utm.medium, 120),
            utmCampaign: trimOrNull(ctx.utm.campaign, 120),
            utmContent: trimOrNull(ctx.utm.content, 120),
            utmTerm: trimOrNull(ctx.utm.term, 120),
            referrer: trimOrNull(ctx.referrer, 300),
            landingHost: trimOrNull(ctx.landingHost, 120),
            submissionIdentifier: ctx.submissionIdentifier,
          },
        });
        return picked.code;
      });

      if (result === null) {
        logger.warn("voucher.sold_out", {});
        return { ok: false, error: SOLD_OUT_MESSAGE, soldOut: true };
      }
      logger.info("voucher.issued", {});
      return { ok: true, code: result, alreadyIssued: false };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = String(error.meta?.target ?? "");
        if (target.includes("orderNumberHash")) {
          // Wettlauf derselben Bestellung: Wiedervorlage-Logik erneut anwenden
          const raced = await prisma.voucherRedemption.findUnique({
            where: { orderNumberHash: orderHash },
            select: { emailHash: true, voucherCode: { select: { code: true } } },
          });
          if (raced?.emailHash === emailHash) {
            return { ok: true, code: raced.voucherCode.code, alreadyIssued: true };
          }
          return { ok: false, error: DUPLICATE_MESSAGE, fieldErrors: { orderNumber: DUPLICATE_MESSAGE } };
        }
        // voucherCodeId-Kollision (sollte durch SKIP LOCKED nicht auftreten) → erneut
        continue;
      }
      logger.error("voucher.persist_failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
      return { ok: false, error: GENERIC_ERROR };
    }
  }
  logger.error("voucher.assignment_exhausted", {});
  return { ok: false, error: GENERIC_ERROR };
}

/* ------------------------------------------------------------------------ */
/* Import                                                                    */
/* ------------------------------------------------------------------------ */

export interface ParsedCodes {
  codes: string[];
  invalid: number;
}

/**
 * Codes aus Freitext/CSV extrahieren. Unterstützt:
 * - eine Kopfzeile mit Spalte "code" (Trennzeichen ; , oder Tab)
 * - reine Listen (ein Code pro Zeile)
 * - Zeilen mit Trennzeichen ohne Kopfzeile (erste Zelle mit Buchstaben)
 */
export function parseVoucherCodes(text: string): ParsedCodes {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { codes: [], invalid: 0 };

  const delimiter = lines[0]!.includes(";") ? ";" : lines[0]!.includes(",") ? "," : lines[0]!.includes("\t") ? "\t" : null;
  const headerCells = delimiter
    ? lines[0]!.split(delimiter).map((c) => c.trim().toLowerCase())
    : [lines[0]!.trim().toLowerCase()];
  const codeIdx = headerCells.indexOf("code");
  const hasHeader = codeIdx >= 0;

  const seen = new Set<string>();
  const codes: string[] = [];
  let invalid = 0;
  for (const [index, line] of lines.entries()) {
    if (hasHeader && index === 0) continue;
    let candidate: string | undefined;
    if (delimiter) {
      const cells = line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));
      candidate = hasHeader
        ? cells[codeIdx]
        : (cells.find((c) => /[A-Za-z]/.test(c) && GUTSCHEIN_CODE_PATTERN.test(c)) ?? cells[0]);
    } else {
      candidate = line.replace(/^"|"$/g, "");
    }
    if (!candidate || !GUTSCHEIN_CODE_PATTERN.test(candidate)) {
      invalid++;
      continue;
    }
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    codes.push(candidate);
  }
  return { codes, invalid };
}

export async function importVoucherCodes(
  text: string,
  batch: string | null,
): Promise<{ imported: number; duplicates: number; invalid: number }> {
  const { codes, invalid } = parseVoucherCodes(text);
  if (codes.length === 0) return { imported: 0, duplicates: 0, invalid };
  const result = await prisma.voucherCode.createMany({
    data: codes.map((code) => ({ id: randomUUID(), code, batch })),
    skipDuplicates: true,
  });
  return { imported: result.count, duplicates: codes.length - result.count, invalid };
}

/* ------------------------------------------------------------------------ */
/* Dashboard                                                                 */
/* ------------------------------------------------------------------------ */

export interface VoucherStats {
  totalCodes: number;
  issued: number;
  remaining: number;
  today: number;
  last7Days: number;
  bySource: Array<{ source: string; count: number }>;
  byRetailer: Array<{ retailer: string; count: number }>;
  byDay: Array<{ day: string; count: number }>;
}

export async function getVoucherStats(): Promise<VoucherStats> {
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [totalCodes, issued, last7Days, todayRows, sourceGroups, retailerGroups, byDay] =
    await Promise.all([
      prisma.voucherCode.count(),
      prisma.voucherRedemption.count(),
      prisma.voucherRedemption.count({ where: { createdAt: { gte: since7d } } }),
      prisma.$queryRaw<Array<{ count: number }>>`
        SELECT count(*)::int AS count FROM "VoucherRedemption"
        WHERE ("createdAt" AT TIME ZONE 'Europe/Berlin')::date = (now() AT TIME ZONE 'Europe/Berlin')::date
      `,
      prisma.voucherRedemption.groupBy({
        by: ["utmSource"],
        _count: { _all: true },
        orderBy: { _count: { utmSource: "desc" } },
        take: 8,
      }),
      prisma.voucherRedemption.groupBy({
        by: ["retailer"],
        _count: { _all: true },
        orderBy: { _count: { retailer: "desc" } },
      }),
      prisma.$queryRaw<Array<{ day: string; count: number }>>`
        SELECT to_char(("createdAt" AT TIME ZONE 'Europe/Berlin')::date, 'YYYY-MM-DD') AS day,
               count(*)::int AS count
        FROM "VoucherRedemption"
        WHERE "createdAt" >= now() - interval '14 days'
        GROUP BY 1 ORDER BY 1 DESC
      `,
    ]);
  return {
    totalCodes,
    issued,
    remaining: Math.max(0, totalCodes - issued),
    today: todayRows[0]?.count ?? 0,
    last7Days,
    bySource: sourceGroups.map((g) => ({
      source: g.utmSource ?? "(direkt)",
      count: g._count._all,
    })),
    byRetailer: retailerGroups.map((g) => ({ retailer: g.retailer, count: g._count._all })),
    byDay,
  };
}

export async function countAvailableVouchers(): Promise<number> {
  const [total, issued] = await Promise.all([
    prisma.voucherCode.count(),
    prisma.voucherRedemption.count(),
  ]);
  return Math.max(0, total - issued);
}
