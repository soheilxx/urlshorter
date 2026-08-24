"use client";

import { useActionState } from "react";
import { EMPTY_LINK_STATE } from "@/actions/action-states";
import { createShortLinkAction, updateShortLinkAction } from "@/actions/link-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";

export interface DestinationOption {
  id: string;
  name: string;
  host: string;
  active: boolean;
}

export interface LinkFormValues {
  id?: string;
  destinationId?: string;
  name?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  note?: string;
  /** YYYY-MM-DD */
  expiresAt?: string;
}

export function LinkForm({
  destinations,
  initialValues,
  mode,
}: {
  destinations: DestinationOption[];
  initialValues?: LinkFormValues;
  mode: "create" | "edit";
}) {
  const action = mode === "create" ? createShortLinkAction : updateShortLinkAction;
  const [state, formAction, pending] = useActionState(action, EMPTY_LINK_STATE);
  const v = initialValues ?? {};

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}

      {mode === "edit" && v.id ? <input type="hidden" name="id" value={v.id} /> : null}

      <div>
        <Label htmlFor="destinationId">Ziel (Destination)</Label>
        <Select
          id="destinationId"
          name="destinationId"
          required
          defaultValue={v.destinationId ?? ""}
        >
          <option value="" disabled>
            Bitte auswählen …
          </option>
          {destinations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.host}){d.active ? "" : " – inaktiv"}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Interner Linkname</Label>
          <Input
            id="name"
            name="name"
            required
            maxLength={200}
            defaultValue={v.name ?? ""}
            placeholder="z. B. Instagram Profil Bio"
          />
        </div>
        <div>
          <Label htmlFor="source">Source</Label>
          <Input
            id="source"
            name="source"
            required
            maxLength={200}
            defaultValue={v.source ?? ""}
            placeholder="z. B. Instagram Profil"
          />
        </div>
        <div>
          <Label htmlFor="medium">Medium (optional)</Label>
          <Input
            id="medium"
            name="medium"
            maxLength={200}
            defaultValue={v.medium ?? ""}
            placeholder="z. B. social"
          />
        </div>
        <div>
          <Label htmlFor="campaign">Kampagne (optional)</Label>
          <Input
            id="campaign"
            name="campaign"
            maxLength={200}
            defaultValue={v.campaign ?? ""}
            placeholder="z. B. Buchlaunch"
          />
        </div>
        <div>
          <Label htmlFor="content">Content/Variante (optional)</Label>
          <Input
            id="content"
            name="content"
            maxLength={200}
            defaultValue={v.content ?? ""}
            placeholder="z. B. Variante A"
          />
        </div>
        <div>
          <Label htmlFor="expiresAt">Ablaufdatum (optional, Ende des Tages)</Label>
          <Input id="expiresAt" name="expiresAt" type="date" defaultValue={v.expiresAt ?? ""} />
        </div>
      </div>

      <div>
        <Label htmlFor="note">Notiz (optional)</Label>
        <Textarea
          id="note"
          name="note"
          rows={2}
          maxLength={1000}
          defaultValue={v.note ?? ""}
          placeholder="Interne Notiz zu diesem Link …"
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending
          ? "Wird gespeichert …"
          : mode === "create"
            ? "Kurzlink erstellen"
            : "Änderungen speichern"}
      </Button>
    </form>
  );
}
