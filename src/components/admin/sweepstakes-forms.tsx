"use client";

import { useActionState } from "react";
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

/** Status + interne Notiz einer Gewinnspiel-Teilnahme bearbeiten (nur ADMIN). */
export function SweepstakesStatusForm({
  entry,
}: {
  entry: { id: string; status: string; internalNote: string | null };
}) {
  const [state, formAction, pending] = useActionState(
    updateSweepstakesEntryAction,
    EMPTY_USER_STATE,
  );
  const formRef = useSuccessRefresh(state);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}

      <input type="hidden" name="id" value={entry.id} />
      <div>
        <Label htmlFor="sw-status">Status</Label>
        <Select id="sw-status" name="status" defaultValue={entry.status} required>
          {EDITABLE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {SWEEPSTAKES_STATUS_LABELS[status] ?? status}
            </option>
          ))}
        </Select>
      </div>
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
