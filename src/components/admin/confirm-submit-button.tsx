"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Zweistufiger Submit-Button für kritische Aktionen:
 * Erster Klick zeigt eine Inline-Bestätigung, erst der zweite Klick sendet
 * das Formular ab. Verhindert unbeabsichtigte Änderungen ohne Modal.
 */
export function ConfirmSubmitButton({
  children,
  confirmText = "Wirklich?",
  variant = "secondary",
  size = "sm",
  ...props
}: ButtonProps & { confirmText?: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setConfirming(true)}
        {...props}
      >
        {children}
      </Button>
    );
  }

  return (
    // Mobil untereinander (schmale Karten-Spalten sprengen sonst die Seite),
    // ab sm nebeneinander wie bisher in den Desktop-Tabellen.
    <span className="flex w-full max-w-full flex-col gap-1.5 sm:w-auto sm:flex-row sm:items-center">
      <Button
        type="submit"
        variant="danger"
        size={size}
        {...props}
        className={`w-full sm:w-auto ${props.className ?? ""}`}
      >
        {confirmText}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size={size}
        onClick={() => setConfirming(false)}
        className="w-full sm:w-auto"
      >
        Abbrechen
      </Button>
    </span>
  );
}
