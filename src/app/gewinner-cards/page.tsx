import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ProductShowcase } from "@/components/cards/product-showcase";
import { TripleChanceDraw } from "@/components/draw/triple-chance";
import { requireRole } from "@/lib/auth";
import { getCardsDrawState } from "@/lib/cards-draw";
import {
  CARDS_CARDMARKET_VALUE_LABEL,
  CARDS_PRIZES,
  type CardsPrizeId,
} from "@/lib/cards-giveaway-config";

/**
 * Gewinnziehung des Cards-Gewinnspiels als „Triple Chance“-Automat.
 * Nur für angemeldete Admins (requireRole leitet sonst zum Login); noindex und
 * no-store (next.config.ts). Zeigt Vorname + Initial, Los-Nummern und
 * Bestellnummern. Die Ziehung selbst passiert serverseitig (src/lib/cards-draw.ts).
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Gewinnziehung Cards · Triple Chance" },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default async function GewinnerCardsPage() {
  const session = await requireRole("ADMIN");
  const state = await getCardsDrawState();
  const voucher = (
    <div
      className="cd-voucher cd-voucher--compact"
      role="img"
      aria-label={`Wertgutschein für cardmarket.pro über ${CARDS_CARDMARKET_VALUE_LABEL}`}
    >
      <div className="cd-voucher-holo" aria-hidden="true" />
      <div className="cd-voucher-pattern" aria-hidden="true" />
      <div className="cd-voucher-body">
        <div className="flex items-start justify-between gap-3">
          <span className="cd-voucher-chip" aria-hidden="true" />
          <span className="cd-voucher-kicker">
            <span className="block">Wertgutschein</span>
            <span className="cd-voucher-brand block">cardmarket.pro</span>
          </span>
        </div>
        <p className="cd-voucher-value">{CARDS_CARDMARKET_VALUE_LABEL}</p>
      </div>
    </div>
  );
  const voucherMini = (
    <div
      className="tc-voucher-mini"
      role="img"
      aria-label={`Wertgutschein für cardmarket.pro über ${CARDS_CARDMARKET_VALUE_LABEL}`}
    >
      <span className="tc-voucher-mini-value">{CARDS_CARDMARKET_VALUE_LABEL}</span>
      <span className="tc-voucher-mini-label">Wertgutschein</span>
      <span className="tc-voucher-mini-brand">cardmarket.pro</span>
    </div>
  );
  const visuals = (size: "mini" | "panel") =>
    Object.fromEntries(
      CARDS_PRIZES.map((prize) => [
        prize.id,
        prize.image ? (
          <ProductShowcase prize={prize} size={size} showCaption={false} />
        ) : size === "mini" ? (
          voucherMini
        ) : (
          voucher
        ),
      ]),
    ) as Record<CardsPrizeId, ReactNode>;

  return (
    <TripleChanceDraw
      initialState={state}
      prizeVisuals={visuals("mini")}
      prizeVisualsLarge={visuals("panel")}
      actor={session.email}
      exportHref="/api/export/sweepstakes?campaign=cards_2026&status=WINNER"
    />
  );
}
