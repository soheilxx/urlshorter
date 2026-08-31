"use client";

import { useActionState } from "react";
import { EMPTY_LINK_STATE } from "@/actions/action-states";
import { createBulkLinksAction } from "@/actions/link-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import type { DestinationOption } from "@/components/admin/link-form";
import { useSuccessRefresh } from "@/components/admin/use-success-refresh";

export function BulkLinkForm({ destinations }: { destinations: DestinationOption[] }) {
  const [state, formAction, pending] = useActionState(createBulkLinksAction, EMPTY_LINK_STATE);
  const formRef = useSuccessRefresh(state);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}

      <div>
        <Label htmlFor="destinationId">Ziel (Destination) für alle Links</Label>
        <Select id="destinationId" name="destinationId" required defaultValue="">
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
          <Label htmlFor="namePrefix">Namens-Präfix</Label>
          <Input
            id="namePrefix"
            name="namePrefix"
            required
            maxLength={150}
            placeholder="z. B. Buchlaunch"
          />
          <p className="mt-1 text-xs text-zinc-400">
            Linkname wird zu „Präfix – Source“, z. B. „Buchlaunch – Newsletter“.
          </p>
        </div>
        <div>
          <Label htmlFor="campaign">Kampagne (optional, für alle Links)</Label>
          <Input id="campaign" name="campaign" maxLength={200} placeholder="z. B. Buchlaunch" />
        </div>
        <div>
          <Label htmlFor="medium">Medium (optional, für alle Links)</Label>
          <Input id="medium" name="medium" maxLength={200} placeholder="z. B. social" />
        </div>
        <div>
          <Label htmlFor="expiresAt">Ablaufdatum (optional, Ende des Tages)</Label>
          <Input id="expiresAt" name="expiresAt" type="date" />
        </div>
      </div>

      <div>
        <Label htmlFor="sources">Sources (eine pro Zeile, max. 50)</Label>
        <Textarea
          id="sources"
          name="sources"
          required
          rows={6}
          placeholder={"Instagram Profil\nMeta Ad 01\nNewsletter\nPlakat Berlin"}
        />
      </div>

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Links werden erstellt …" : "Alle Kurzlinks erstellen"}
      </Button>
    </form>
  );
}
