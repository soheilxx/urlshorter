import "server-only";
import { requireAppSecret } from "@/lib/env";
import { getClientIp } from "@/lib/request-info";
import type { SubmitContext } from "@/lib/sweepstakes";
import { computeRateLimitIdentifier } from "@/lib/visitor-hash";

/**
 * Gemeinsames Auslesen der Teilnahme-Formulardaten für alle Kampagnen-Actions.
 * Liefert bewusst KEINE Kampagne und KEINEN Teilnahmeweg – beides legt die
 * jeweilige Server Action serverseitig fest (kein Client-Einfluss auf den Lostopf).
 */

function str(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

export function optionalField(formData: FormData, name: string): string | null {
  const v = str(formData, name).trim();
  return v.length > 0 ? v : null;
}

export interface SweepstakesFormRead {
  input: Record<string, unknown>;
  ctx: Omit<SubmitContext, "campaign" | "landingPath" | "now">;
  utm: SubmitContext["utm"];
}

export function readSweepstakesForm(formData: FormData, h: Headers): SweepstakesFormRead {
  const submissionIdentifier = computeRateLimitIdentifier({
    secret: requireAppSecret(),
    ip: getClientIp(h),
    userAgent: h.get("user-agent"),
  });
  const utm = {
    source: optionalField(formData, "utm_source"),
    medium: optionalField(formData, "utm_medium"),
    campaign: optionalField(formData, "utm_campaign"),
    content: optionalField(formData, "utm_content"),
    term: optionalField(formData, "utm_term"),
  };
  return {
    input: {
      retailer: str(formData, "retailer"),
      retailerOther: str(formData, "retailerOther") || undefined,
      orderNumber: str(formData, "orderNumber"),
      firstName: str(formData, "firstName"),
      lastName: str(formData, "lastName"),
      street: str(formData, "street"),
      houseNumber: str(formData, "houseNumber"),
      postalCode: str(formData, "postalCode"),
      city: str(formData, "city"),
      country: str(formData, "country"),
      email: str(formData, "email"),
      phone: str(formData, "phone"),
      consent: formData.get("consent") === "on",
    },
    ctx: {
      submissionIdentifier,
      honeypot: optionalField(formData, "website"),
      formToken: optionalField(formData, "formToken"),
      utm,
      referrer: optionalField(formData, "clientReferrer"),
      landingHost: h.get("host"),
    },
    utm,
  };
}
