"use client";

import { useActionState } from "react";
import { EMPTY_VOUCHER_IMPORT_STATE } from "@/actions/action-states";
import { importVoucherCodesAction } from "@/actions/gutschein-actions";
import { useSuccessRefresh } from "@/components/admin/use-success-refresh";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

/**
 * Gutscheincodes importieren: CSV-/TXT-Datei hochladen ODER Codes einfügen
 * (Kopfzeile mit Spalte „code“ oder ein Code pro Zeile). Doppelte Codes
 * werden übersprungen.
 */
export function GutscheinImportForm() {
  const [state, formAction, pending] = useActionState(
    importVoucherCodesAction,
    EMPTY_VOUCHER_IMPORT_STATE,
  );
  const formRef = useSuccessRefresh(state, true);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      {state.ok && state.success ? <Alert variant="success">{state.success}</Alert> : null}

      <div>
        <Label htmlFor="voucher-file">CSV- oder TXT-Datei</Label>
        <Input id="voucher-file" name="file" type="file" accept=".csv,.txt,text/csv,text/plain" />
        <p className="mt-1 text-xs text-zinc-400">
          Erwartet eine Spalte „code“ (z. B. Export aus dem Shop) oder einen Code pro Zeile.
        </p>
      </div>
      <div>
        <Label htmlFor="voucher-codes">… oder Codes einfügen</Label>
        <Textarea
          id="voucher-codes"
          name="codes"
          rows={5}
          placeholder={"C30BF207\nC30BF558\n…"}
          className="font-mono"
        />
      </div>
      <div>
        <Label htmlFor="voucher-batch">Bezeichnung der Charge (optional)</Label>
        <Input id="voucher-batch" name="batch" maxLength={120} placeholder="z. B. Newsletter September" />
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Wird importiert …" : "Codes importieren"}
      </Button>
    </form>
  );
}
