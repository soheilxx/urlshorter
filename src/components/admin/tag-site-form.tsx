"use client";

import { useActionState } from "react";
import { EMPTY_USER_STATE } from "@/actions/action-states";
import { saveTagSiteAction } from "@/actions/tag-site-actions";
import { useSuccessRefresh } from "@/components/admin/use-success-refresh";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export interface TagSiteFormValues {
  id: string;
  label: string;
  domains: string;
  active: boolean;
  ga4MeasurementId: string;
  gtmContainerId: string;
  metaPixelId: string;
  tiktokPixelId: string;
  redditPixelId: string;
  linkedinPartnerId: string;
}

/** Website anlegen/bearbeiten – Tokens werden nie im Klartext angezeigt. */
export function TagSiteForm({
  mode,
  values,
  tokenHints,
}: {
  mode: "create" | "edit";
  values: TagSiteFormValues;
  tokenHints: { meta: string | null; tiktok: string | null };
}) {
  const [state, formAction, pending] = useActionState(saveTagSiteAction, EMPTY_USER_STATE);
  const formRef = useSuccessRefresh(state, mode === "create");

  const tokenPlaceholder = (hint: string | null) =>
    hint ? `gespeichert (${hint}) – leer lassen zum Behalten` : "noch nicht hinterlegt";

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="ts-id">Site-ID (Teil des Snippets)</Label>
          {mode === "edit" ? (
            <>
              <Input id="ts-id" value={values.id} disabled className="font-mono" />
              <input type="hidden" name="id" value={values.id} />
            </>
          ) : (
            <Input
              id="ts-id"
              name="id"
              required
              minLength={2}
              maxLength={50}
              pattern="[a-z0-9-]+"
              placeholder="z. B. kunde-mueller"
              className="font-mono"
            />
          )}
        </div>
        <div>
          <Label htmlFor="ts-label">Name</Label>
          <Input
            id="ts-label"
            name="label"
            required
            maxLength={100}
            defaultValue={values.label}
            placeholder="z. B. mueller-shop.de"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="ts-domains">Domains (komma-separiert, inkl. Subdomains automatisch)</Label>
          <Input
            id="ts-domains"
            name="domains"
            required
            defaultValue={values.domains}
            placeholder="beispiel.de, shop.beispiel.de"
            className="font-mono"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          name="active"
          defaultChecked={values.active}
          className="h-4 w-4 rounded border-zinc-300"
        />
        Aktiv (deaktivierte Sites liefern ein leeres Script und verwerfen Events)
      </label>

      <div className="border-t border-zinc-100 pt-4">
        <p className="mb-3 text-sm font-medium text-zinc-700">
          Pixel-IDs <span className="font-normal text-zinc-400">(leer = globaler Standard)</span>
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ts-ga4">GA4 Measurement-ID</Label>
            <Input id="ts-ga4" name="ga4MeasurementId" maxLength={40} defaultValue={values.ga4MeasurementId} placeholder="G-XXXXXXXXXX" className="font-mono" />
          </div>
          <div>
            <Label htmlFor="ts-gtm">GTM Container-ID</Label>
            <Input id="ts-gtm" name="gtmContainerId" maxLength={40} defaultValue={values.gtmContainerId} placeholder="GTM-XXXXXXX" className="font-mono" />
          </div>
          <div>
            <Label htmlFor="ts-meta">Meta Pixel-ID</Label>
            <Input id="ts-meta" name="metaPixelId" maxLength={40} defaultValue={values.metaPixelId} className="font-mono" />
          </div>
          <div>
            <Label htmlFor="ts-tiktok">TikTok Pixel-ID</Label>
            <Input id="ts-tiktok" name="tiktokPixelId" maxLength={40} defaultValue={values.tiktokPixelId} className="font-mono" />
          </div>
          <div>
            <Label htmlFor="ts-reddit">Reddit Pixel-ID</Label>
            <Input id="ts-reddit" name="redditPixelId" maxLength={40} defaultValue={values.redditPixelId} className="font-mono" />
          </div>
          <div>
            <Label htmlFor="ts-linkedin">LinkedIn Partner-ID</Label>
            <Input id="ts-linkedin" name="linkedinPartnerId" maxLength={40} defaultValue={values.linkedinPartnerId} className="font-mono" />
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-100 pt-4">
        <p className="mb-3 text-sm font-medium text-zinc-700">
          Conversion-API-Tokens{" "}
          <span className="font-normal text-zinc-400">
            (verschlüsselt gespeichert, nie im Klartext angezeigt)
          </span>
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ts-metatoken">Meta CAPI Access-Token</Label>
            <Input
              id="ts-metatoken"
              name="metaCapiToken"
              type="password"
              maxLength={500}
              autoComplete="off"
              placeholder={tokenPlaceholder(tokenHints.meta)}
            />
          </div>
          <div>
            <Label htmlFor="ts-tiktoktoken">TikTok Events-API-Token</Label>
            <Input
              id="ts-tiktoktoken"
              name="tiktokToken"
              type="password"
              maxLength={500}
              autoComplete="off"
              placeholder={tokenPlaceholder(tokenHints.tiktok)}
            />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending
          ? "Wird gespeichert …"
          : mode === "create"
            ? "Website anlegen"
            : "Änderungen speichern"}
      </Button>
    </form>
  );
}
