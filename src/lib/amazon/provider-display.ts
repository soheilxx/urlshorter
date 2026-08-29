import "server-only";
import { prisma } from "@/lib/db";

/**
 * Anzeige-Nuance für die Amazon Creators API: Ein 403 mit Eligibility-Meldung
 * bedeutet "Amazon hat den Katalogzugriff noch nicht freigeschaltet"
 * (Associates-Programm verlangt qualifizierte Verkäufe) – das ist ein
 * Wartezustand, keine Störung unserer Integration (OAuth funktioniert).
 */
export async function creatorsAwaitingEligibility(): Promise<boolean> {
  const lastFailed = await prisma.amazonProviderRun.findFirst({
    where: { provider: "CREATORS", status: "FAILED" },
    orderBy: { startedAt: "desc" },
    select: { safeErrorMessage: true, httpStatus: true },
  });
  if (!lastFailed) return false;
  return (
    lastFailed.httpStatus === 403 &&
    /eligib|not currently meet/i.test(lastFailed.safeErrorMessage ?? "")
  );
}
