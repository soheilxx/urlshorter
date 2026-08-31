"use client";

import { useActionState } from "react";
import { EMPTY_USER_STATE } from "@/actions/action-states";
import { searchCategoryAction } from "@/actions/amazon-actions";
import { useSuccessRefresh } from "@/components/admin/use-success-refresh";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

/** Rainforest-Kategoriensuche: legt Treffer als inaktive Kategorien an. */
export function CategorySearchForm() {
  const [state, formAction, pending] = useActionState(searchCategoryAction, EMPTY_USER_STATE);
  const formRef = useSuccessRefresh(state, true);
  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor="cs-term">Suchbegriff (Bestsellerkategorie auf Amazon.de)</Label>
          <Input id="cs-term" name="term" required minLength={2} maxLength={100} placeholder="z. B. Wirtschaft" />
        </div>
        <Button type="submit" disabled={pending} variant="secondary" className="w-full sm:w-auto">
          {pending ? "Suche …" : "Suchen"}
        </Button>
      </div>
      <p className="text-xs text-zinc-400">
        Treffer werden als inaktive Kategorien mit vollständigem Pfad gespeichert – danach Mapping
        prüfen, verifizieren und aktivieren. Verbraucht einen Rainforest-Request.
      </p>
    </form>
  );
}
