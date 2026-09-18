"use client";

import { useActionState, useState } from "react";
import { EMPTY_USER_STATE } from "@/actions/action-states";
import { updateSweepstakesEntryAction } from "@/actions/sweepstakes-actions";
import { useSuccessRefresh } from "@/components/admin/use-success-refresh";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/input";
import { SWEEPSTAKES_STATUS_LABELS } from "@/lib/gewinnspiel-config";

const EDITABLE_STATUSES = [
  "RECEIVED",
  "IN_REVIEW",
  "REVIEWED",
  "INVALID",
  "WINNER",
  "NOT_WON",
] as const;

/**
 * Status, Gewinnzuordnung und interne Notiz einer Teilnahme bearbeiten (nur ADMIN).
 * Die Kampagne wird mitgesendet und serverseitig gegen die Teilnahme geprüft;
 * der Gewinnkatalog enthält ausschließlich Gewinne DIESER Kampagne.
 */
export function SweepstakesStatusForm({
  entry,
  campaignLabel,
  prizes,
}: {
  entry: {
    id: string;
    campaignId: string;
    status: string;
    prizeId: string | null;
    internalNote: string | null;
  };
  campaignLabel: string;
  prizes: ReadonlyArray<{ id: string; label: string }>;
}) {
  const [state, formAction, pending] = useActionState(
    updateSweepstakesEntryAction,
    EMPTY_USER_STATE,
  );
  const formRef = useSuccessRefresh(state);
  const [status, setStatus] = useState(entry.status);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}

      <input type="hidden" name="id" value={entry.id} />
      <input type="hidden" name="campaignId" value={entry.campaignId} />
      <div>
        <Label htmlFor="sw-status">Status</Label>
        <Select
          id="sw-status"
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          required
        >
          {EDITABLE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {SWEEPSTAKES_STATUS_LABELS[s] ?? s}
            </option>
          ))}
        </Select>
      </div>
      {status === "WINNER" ? (
        <div>
          <Label htmlFor="sw-prize">Gewinn (Kampagne {campaignLabel})</Label>
          <Select id="sw-prize" name="prizeId" defaultValue={entry.prizeId ?? ""} required>
            <option value="" disabled>
              Bitte auswählen …
            </option>
            {prizes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-zinc-500">
            Nur Gewinne dieser Kampagne wählbar – kampagnenfremde Zuordnungen lehnt der Server ab.
          </p>
        </div>
      ) : null}
      <div>
        <Label htmlFor="sw-note">Interne Notiz (nie öffentlich)</Label>
        <Textarea
          id="sw-note"
          name="internalNote"
          rows={4}
          maxLength={2000}
          defaultValue={entry.internalNote ?? ""}
          placeholder="z. B. Bestellnummer beim Händler geprüft am …"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Wird gespeichert …" : "Änderungen speichern"}
      </Button>
    </form>
  );
}
