"use client";

import { useActionState } from "react";
import { EMPTY_SETTINGS_STATE } from "@/actions/action-states";
import { updateRedirectDelayAction } from "@/actions/settings-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function SettingsForm({ currentDelayMs }: { currentDelayMs: number }) {
  const [state, formAction, pending] = useActionState(
    updateRedirectDelayAction,
    EMPTY_SETTINGS_STATE,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}

      <div>
        <Label htmlFor="delayMs">Weiterleitungsverzögerung (Millisekunden, 300–2000)</Label>
        <Input
          id="delayMs"
          name="delayMs"
          type="number"
          min={300}
          max={2000}
          step={50}
          required
          defaultValue={currentDelayMs}
          className="max-w-[200px]"
        />
        <p className="mt-1 text-xs text-zinc-400">
          Zeit, die die Weiterleitungsseite den Tracking-Pixeln gibt, bevor zur Amazon-URL
          weitergeleitet wird.
        </p>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Wird gespeichert …" : "Speichern"}
      </Button>
    </form>
  );
}
