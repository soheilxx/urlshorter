"use client";

import { submitCardsEntryAction } from "@/actions/cards-actions";
import { EntryForm, type UtmParams } from "@/components/gewinn/entry-form";
import {
  CARDS_ANNOUNCEMENT_DATETIME_LABEL,
  CARDS_ENTRY_DEADLINE_LABEL,
  CARDS_TERMS_PATH,
} from "@/lib/cards-giveaway-config";

/**
 * Teilnahmeformular des Cards-Gewinnspiels: gemeinsames EntryForm (Validierung,
 * Anti-Bot, Duplikate je Kampagne unverändert) mit der Cards-Server-Action, die
 * Kampagne und Teilnahmeweg serverseitig festlegt. Nach dem Speichern leitet
 * die Action auf /cards/danke weiter (Receipt-Cookie); ein „weiterer Vorgang“
 * startet über /cards#teilnehmen mit frischem Formular-Token.
 */
export function CardsEntry({
  formToken,
  utm,
  privacyUrl,
}: {
  formToken: string;
  utm: UtmParams;
  privacyUrl: string | null;
}) {
  return (
    <EntryForm
      action={submitCardsEntryAction}
      formToken={formToken}
      utm={utm}
      privacyUrl={privacyUrl}
      landingPath="/cards"
      submitLabel="Bestellnummer für das Cards-Gewinnspiel registrieren"
      termsHref={CARDS_TERMS_PATH}
      submitHint={
        <>
          Bis zum {CARDS_ENTRY_DEADLINE_LABEL} teilnehmen. Die Gewinner werden am{" "}
          {CARDS_ANNOUNCEMENT_DATETIME_LABEL} bekannt gegeben. Diese Anmeldung gilt ausschließlich
          für das Cards-Gewinnspiel.
        </>
      }
    />
  );
}
