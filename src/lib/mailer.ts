import "server-only";
import { logger } from "@/lib/logger";

/**
 * E-Mail-Versand (Bestätigungs-Mails des Gewinnspiels).
 *
 * Im Projekt existiert noch KEINE E-Mail-Infrastruktur. Diese Schnittstelle
 * ist bewusst so gebaut, dass später nur sendMail() implementiert werden muss
 * (z. B. Resend, Postmark oder SMTP). Es wird NIEMALS ein erfolgreicher
 * Versand simuliert – ohne Konfiguration ist das Ergebnis { sent: false }.
 *
 * Benötigte Konfiguration (noch zu ergänzen, siehe Abschlussbericht):
 *   MAIL_FROM             Absenderadresse, z. B. gewinnspiel@lizenzzumerfolg.com
 *   RESEND_API_KEY        ODER SMTP_URL (smtp://user:pass@host:port)
 */

export interface MailResult {
  sent: boolean;
  reason: "not_configured" | "send_failed" | null;
}

export function isMailerConfigured(): boolean {
  return Boolean(
    process.env.MAIL_FROM && (process.env.RESEND_API_KEY || process.env.SMTP_URL),
  );
}

export async function sendSweepstakesConfirmation(input: {
  to: string;
  firstName: string;
  referenceNumber: string;
}): Promise<MailResult> {
  if (!isMailerConfigured()) {
    logger.info("mailer.skipped_not_configured", { template: "sweepstakes_confirmation" });
    return { sent: false, reason: "not_configured" };
  }
  // Bewusst noch nicht implementiert: erst wenn ein Dienst konfiguriert ist,
  // wird hier der tatsächliche Versand ergänzt (keine Simulation).
  logger.warn("mailer.provider_not_implemented", {
    template: "sweepstakes_confirmation",
    to: "redacted",
    reference: input.referenceNumber,
  });
  return { sent: false, reason: "send_failed" };
}
