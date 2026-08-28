import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  getSweepstakesPhase,
  isRetailerId,
  MAX_FORM_HOURS,
  MIN_FORM_SECONDS,
  PRIVACY_VERSION,
  SUBMISSION_RATE_LIMIT,
  TERMS_VERSION,
} from "@/lib/gewinnspiel-config";
import { logger } from "@/lib/logger";
import { sendSweepstakesConfirmation } from "@/lib/mailer";
import {
  encryptOrderNumber,
  generateReferenceNumber,
  hashOrderNumber,
  newEntryId,
  verifyFormToken,
} from "@/lib/sweepstakes-crypto";
import {
  normalizeOrderNumber,
  normalizePhone,
  sweepstakesInputSchema,
} from "@/lib/sweepstakes-validation";

/**
 * Kernlogik der Gewinnspiel-Teilnahme – bewusst getrennt von der Server
 * Action, damit sie in Integrationstests ohne Next-Request-Kontext läuft.
 *
 * Datenschutz: Es werden keine personenbezogenen Daten geloggt; Fehlertexte
 * für Besucher enthalten keine technischen Details.
 */

export interface SubmitContext {
  /** Nicht rückrechenbare Client-Kennung (HMAC aus IP + User-Agent) */
  submissionIdentifier: string | null;
  /** Honeypot-Feld (muss leer sein) */
  honeypot: string | null;
  /** Signiertes Formular-Token (Ausgabezeitpunkt) */
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

export type SubmitResult =
  | { ok: true; referenceNumber: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const DUPLICATE_MESSAGE =
  "Diese Bestellnummer wurde bereits für das Gewinnspiel registriert. Falls du glaubst, dass es sich um einen Fehler handelt, kontaktiere bitte den Support.";

const GENERIC_ERROR =
  "Deine Teilnahme konnte gerade nicht gespeichert werden. Bitte versuche es in einem Moment erneut.";

function trimOrNull(value: unknown, max = 300): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  return v.slice(0, max);
}

export async function submitSweepstakesEntry(
  rawInput: Record<string, unknown>,
  ctx: SubmitContext,
): Promise<SubmitResult> {
  const now = ctx.now ?? new Date();

  // 1) Phase prüfen (zeitlich zentral konfiguriert)
  const phase = getSweepstakesPhase(now);
  if (phase === "scheduled") {
    return { ok: false, error: "Die Teilnahme hat noch nicht begonnen." };
  }
  if (phase !== "open") {
    return { ok: false, error: "Die Teilnahme ist beendet." };
  }

  // 2) Honeypot: still akzeptieren, aber nichts speichern (Bots erfahren nichts).
  if (ctx.honeypot && ctx.honeypot.trim().length > 0) {
    logger.warn("sweepstakes.honeypot_tripped", {});
    return { ok: true, referenceNumber: generateReferenceNumber() };
  }

  // 3) Formular-Token (Mindest-/Höchstalter)
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

  // 4) Rate Limiting pro Client-Kennung
  if (ctx.submissionIdentifier) {
    const windowStart = new Date(
      now.getTime() - SUBMISSION_RATE_LIMIT.windowMinutes * 60 * 1000,
    );
    const recent = await prisma.sweepstakesEntry.count({
      where: {
        submissionIdentifier: ctx.submissionIdentifier,
        createdAt: { gte: windowStart },
      },
    });
    if (recent >= SUBMISSION_RATE_LIMIT.maxPerWindow) {
      logger.warn("sweepstakes.rate_limited", {});
      return {
        ok: false,
        error: "Zu viele Registrierungen in kurzer Zeit. Bitte versuche es später erneut.",
      };
    }
  }

  // 5) Feldvalidierung (Zod) – feldbezogene Fehlermeldungen
  const parsed = sweepstakesInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      ok: false,
      error: "Bitte prüfe die markierten Felder.",
      fieldErrors,
    };
  }
  const input = parsed.data;

  if (!isRetailerId(input.retailer)) {
    return {
      ok: false,
      error: "Bitte prüfe die markierten Felder.",
      fieldErrors: { retailer: "Bitte einen gültigen Händler auswählen." },
    };
  }
  if (input.retailer === "other" && !input.retailerOther) {
    return {
      ok: false,
      error: "Bitte prüfe die markierten Felder.",
      fieldErrors: { retailerOther: "Bitte den Namen des Händlers angeben." },
    };
  }

  // 6) Normalisierung Bestellnummer + Telefon
  const order = normalizeOrderNumber(input.orderNumber);
  if (!order.ok) {
    return {
      ok: false,
      error: "Bitte prüfe die markierten Felder.",
      fieldErrors: { orderNumber: order.error ?? "Ungültige Bestellnummer." },
    };
  }
  const phone = normalizePhone(input.phone);
  if (!phone.ok) {
    return {
      ok: false,
      error: "Bitte prüfe die markierten Felder.",
      fieldErrors: { phone: phone.error ?? "Ungültige Telefonnummer." },
    };
  }

  // 7) Duplikaterkennung (freundlich, ohne Fremddaten preiszugeben)
  const orderHash = hashOrderNumber(order.value);
  const existing = await prisma.sweepstakesEntry.findUnique({
    where: { orderNumberHash: orderHash },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false,
      error: DUPLICATE_MESSAGE,
      fieldErrors: { orderNumber: DUPLICATE_MESSAGE },
    };
  }

  // 8) Speichern (Referenz-Kollisionen und Hash-Wettläufe sauber behandeln)
  for (let attempt = 0; attempt < 3; attempt++) {
    const referenceNumber = generateReferenceNumber();
    try {
      const entry = await prisma.sweepstakesEntry.create({
        data: {
          id: newEntryId(),
          referenceNumber,
          retailer: input.retailer,
          retailerOther: input.retailer === "other" ? (input.retailerOther ?? null) : null,
          orderNumberHash: orderHash,
          orderNumberEncrypted: encryptOrderNumber(input.orderNumber.trim()),
          firstName: input.firstName,
          lastName: input.lastName,
          street: input.street,
          houseNumber: input.houseNumber,
          postalCode: input.postalCode,
          city: input.city,
          country: input.country,
          email: input.email,
          phone: phone.value,
          confirmedAccuracyAt: now,
          acceptedTermsAt: now,
          termsVersion: TERMS_VERSION,
          acknowledgedPrivacyAt: now,
          privacyVersion: PRIVACY_VERSION,
          utmSource: trimOrNull(ctx.utm.source, 120),
          utmMedium: trimOrNull(ctx.utm.medium, 120),
          utmCampaign: trimOrNull(ctx.utm.campaign, 120),
          utmContent: trimOrNull(ctx.utm.content, 120),
          utmTerm: trimOrNull(ctx.utm.term, 120),
          referrer: trimOrNull(ctx.referrer, 300),
          landingHost: trimOrNull(ctx.landingHost, 120),
          submissionIdentifier: ctx.submissionIdentifier,
        },
        select: { id: true, referenceNumber: true, email: true, firstName: true },
      });

      // Bestätigungs-E-Mail (nur wenn tatsächlich versendet, Zeitpunkt setzen)
      const mail = await sendSweepstakesConfirmation({
        to: entry.email,
        firstName: entry.firstName,
        referenceNumber: entry.referenceNumber,
      });
      if (mail.sent) {
        await prisma.sweepstakesEntry.update({
          where: { id: entry.id },
          data: { emailConfirmationSentAt: new Date() },
        });
      }

      logger.info("sweepstakes.entry_created", { reference: entry.referenceNumber });
      return { ok: true, referenceNumber: entry.referenceNumber };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = String(error.meta?.target ?? "");
        if (target.includes("orderNumberHash")) {
          return {
            ok: false,
            error: DUPLICATE_MESSAGE,
            fieldErrors: { orderNumber: DUPLICATE_MESSAGE },
          };
        }
        // Referenz-Kollision: mit neuer Referenz erneut versuchen
        continue;
      }
      logger.error("sweepstakes.persist_failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
      return { ok: false, error: GENERIC_ERROR };
    }
  }
  logger.error("sweepstakes.reference_collision_exhausted", {});
  return { ok: false, error: GENERIC_ERROR };
}
