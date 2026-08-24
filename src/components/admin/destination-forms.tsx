"use client";

import { useActionState } from "react";
import { EMPTY_DESTINATION_STATE } from "@/actions/action-states";
import { createDestinationAction, updateDestinationAction } from "@/actions/destination-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function DestinationCreateForm({ hostsHint }: { hostsHint: string }) {
  const [state, formAction, pending] = useActionState(
    createDestinationAction,
    EMPTY_DESTINATION_STATE,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}

      <div>
        <Label htmlFor="dest-name">Interne Bezeichnung</Label>
        <Input
          id="dest-name"
          name="name"
          required
          maxLength={200}
          placeholder="z. B. Amazon Buchseite (DE)"
        />
      </div>
      <div>
        <Label htmlFor="dest-url">Ziel-URL (HTTPS)</Label>
        <Input
          id="dest-url"
          name="url"
          type="url"
          required
          maxLength={2000}
          placeholder="https://www.amazon.de/dp/… oder jede andere HTTPS-URL"
        />
        <p className="mt-1 text-xs text-zinc-400">{hostsHint}</p>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Wird angelegt …" : "Ziel anlegen"}
      </Button>
    </form>
  );
}

export function DestinationEditForm({
  destination,
  linkCount,
  hostsHint,
}: {
  destination: { id: string; name: string; url: string };
  linkCount: number;
  hostsHint: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateDestinationAction,
    EMPTY_DESTINATION_STATE,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error && !state.needsConfirm ? <Alert variant="error">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}

      <input type="hidden" name="id" value={destination.id} />

      <div>
        <Label htmlFor="edit-dest-name">Interne Bezeichnung</Label>
        <Input
          id="edit-dest-name"
          name="name"
          required
          maxLength={200}
          defaultValue={destination.name}
        />
      </div>
      <div>
        <Label htmlFor="edit-dest-url">Ziel-URL (HTTPS)</Label>
        <Input
          id="edit-dest-url"
          name="url"
          type="url"
          required
          maxLength={2000}
          defaultValue={destination.url}
        />
        <p className="mt-1 text-xs text-zinc-400">{hostsHint}</p>
        {linkCount > 0 ? (
          <p className="mt-1 text-xs text-amber-600">
            Dieses Ziel wird von {linkCount} Kurzlink(s) verwendet. Eine URL-Änderung wirkt sich auf
            alle diese Links aus.
          </p>
        ) : null}
      </div>

      {state.needsConfirm ? (
        <Alert variant="error">
          <p className="mb-2 font-medium">{state.error}</p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="confirm"
              value="true"
              className="h-4 w-4 rounded border-zinc-300"
            />
            Ja, ich möchte die Ziel-URL für alle {state.linkCount} Kurzlinks ändern.
          </label>
        </Alert>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Wird gespeichert …" : "Änderungen speichern"}
      </Button>
    </form>
  );
}
