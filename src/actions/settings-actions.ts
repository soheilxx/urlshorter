"use server";

import { z } from "zod";
import { EMPTY_SETTINGS_STATE, type SettingsActionState } from "@/actions/action-states";
import { writeAuditLog } from "@/lib/audit";
import { requireRoleOrThrow } from "@/lib/auth";
import {
  clampRedirectDelay,
  REDIRECT_DELAY_MAX,
  REDIRECT_DELAY_MIN,
  SETTING_REDIRECT_DELAY,
  setSetting,
} from "@/lib/settings";

const delaySchema = z.coerce
  .number({ message: "Bitte eine Zahl angeben." })
  .int("Bitte eine ganze Zahl angeben.")
  .min(REDIRECT_DELAY_MIN, `Minimum: ${REDIRECT_DELAY_MIN} ms`)
  .max(REDIRECT_DELAY_MAX, `Maximum: ${REDIRECT_DELAY_MAX} ms`);

export async function updateRedirectDelayAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  try {
    const session = await requireRoleOrThrow("ADMIN");
    const parsed = delaySchema.safeParse(formData.get("delayMs"));
    if (!parsed.success) {
      return {
        ...EMPTY_SETTINGS_STATE,
        error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe.",
      };
    }

    const value = clampRedirectDelay(parsed.data);
    await setSetting(SETTING_REDIRECT_DELAY, String(value));

    await writeAuditLog({
      actor: session.email,
      action: "settings.update_redirect_delay",
      entityType: "AppSetting",
      entityId: SETTING_REDIRECT_DELAY,
      changes: { delayMs: value },
    });

    // Kein revalidatePath in useActionState-Actions (Race im Client-Router,
    // siehe README → Fehlerbehebung); das Formular ruft router.refresh() auf.
    return {
      ...EMPTY_SETTINGS_STATE,
      ok: true,
      success: `Die Weiterleitungsverzögerung wurde auf ${value} ms gesetzt.`,
    };
  } catch (error) {
    return {
      ...EMPTY_SETTINGS_STATE,
      error: error instanceof Error ? error.message : "Unbekannter Fehler.",
    };
  }
}
