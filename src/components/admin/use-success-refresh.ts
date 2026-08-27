"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Nach einer erfolgreichen Server Action: Seitendaten per router.refresh()
 * aktualisieren und optional das Formular zurücksetzen.
 *
 * Hintergrund (siehe README → Fehlerbehebung): Die Kombination
 * useActionState + revalidatePath kann die Action-Antwort im Client-Router
 * sporadisch verwerfen – der Submit bleibt dann dauerhaft im Pending-Zustand,
 * obwohl der Server geschrieben hat. Deshalb verzichten die zustandsbehafteten
 * Actions auf revalidatePath; dieser Hook holt die frischen Daten nach.
 * Ebenfalls tabu: ein key-Remount des <form>-Elements bei Erfolg (gleiches
 * Symptom).
 */
export function useSuccessRefresh(state: { ok: boolean }, resetForm = false) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state.ok) return;
    if (resetForm) formRef.current?.reset();
    // Kurz entkoppeln: Ein refresh() unmittelbar nach der Action-Antwort kann
    // vom Router verworfen werden, solange die Transition noch abschließt.
    const timer = setTimeout(() => router.refresh(), 300);
    return () => clearTimeout(timer);
  }, [state, resetForm, router]);
  return formRef;
}
