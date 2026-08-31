"use client";

import { Share, X } from "lucide-react";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/admin/brand";
import { Button } from "@/components/ui/button";

/**
 * Wegklickbarer Banner zum Installieren der PWA („Zum Startbildschirm“).
 * - Chrome/Android/Desktop: fängt `beforeinstallprompt` ab und löst den
 *   nativen Install-Dialog über den Button aus.
 * - iOS Safari (kein Install-Event): zeigt die Teilen-Anleitung.
 * - Erscheint nie im installierten Zustand (display-mode: standalone) und
 *   nach dem Wegklicken nicht wieder (localStorage).
 */

const DISMISS_KEY = "tracksite-pwa-banner-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* Private Mode o. Ä. – Banner erscheint dann beim nächsten Besuch erneut */
  }
}

export function PwaInstallBanner() {
  const [mode, setMode] = useState<"hidden" | "native" | "ios">("hidden");
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (wasDismissed() || isStandalone()) return undefined;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setMode("native");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS Safari feuert kein beforeinstallprompt → Anleitung anzeigen
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) setMode("ios");

    const onInstalled = () => setMode("hidden");
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (mode === "hidden") return null;

  const dismiss = () => {
    rememberDismissed();
    setMode("hidden");
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    // Egal wie entschieden wurde: nicht erneut nerven.
    rememberDismissed();
    setMode("hidden");
  };

  return (
    <div
      role="region"
      aria-label="App installieren"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-40 md:inset-x-auto md:bottom-6 md:right-6 md:w-96"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-surface p-3.5 shadow-xl">
        <BrandMark className="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900">TRACK.SITE als App</p>
          {mode === "native" ? (
            <>
              <p className="mt-0.5 text-xs text-zinc-500">
                Installiere das Dashboard auf deinem Gerät – Vollbild, eigenes Icon, ein Tipp
                zum Öffnen.
              </p>
              <div className="mt-2.5 flex gap-2">
                <Button size="sm" onClick={install}>
                  Installieren
                </Button>
                <Button size="sm" variant="ghost" onClick={dismiss}>
                  Später
                </Button>
              </div>
            </>
          ) : (
            <p className="mt-0.5 text-xs text-zinc-500">
              Zum Installieren:{" "}
              <Share className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden="true" />{" "}
              <span className="font-medium text-zinc-700">Teilen</span> →{" "}
              <span className="font-medium text-zinc-700">Zum Home-Bildschirm</span> antippen.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Installations-Hinweis schließen"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
