import type { Metadata } from "next";
import { LotManager } from "@/components/draw/lot-manager";
import { requireRole } from "@/lib/auth";
import { getCardsDrawState } from "@/lib/cards-draw";

/**
 * Los-Verwaltung der Cards-Ziehung (nur Admin): Lose prüfen, Testeinträge
 * ausschließen, wieder aufnehmen. Getrennt von der Bühne /gewinner-cards,
 * damit im Stream keine ausgeschlossenen Lose sichtbar werden.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Lose verwalten · Cards-Ziehung" },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default async function GewinnerCardsLosePage() {
  const session = await requireRole("ADMIN");
  const state = await getCardsDrawState();
  return <LotManager initialState={state} actor={session.email} />;
}
