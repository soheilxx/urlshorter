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
    <span className="inline-flex items-center gap-1.5">
      <Button type="submit" variant="danger" size={size} {...props}>
        {confirmText}
      </Button>
      <Button type="button" variant="ghost" size={size} onClick={() => setConfirming(false)}>
        Abbrechen
      </Button>
    </span>
  );
}
