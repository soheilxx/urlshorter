"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Hell/Dunkel/System-Umschalter. Präferenz liegt im Cookie "theme"
 * (1 Jahr); die .dark-Klasse wird sofort clientseitig gesetzt – das
 * Init-Script im Root-Layout stellt sie beim nächsten Laden vor dem
 * ersten Paint wieder her.
 */

type Theme = "light" | "dark" | "system";

const ORDER: Theme[] = ["system", "light", "dark"];

const LABELS: Record<Theme, string> = {
  system: "Design: automatisch (System)",
  light: "Design: hell",
  dark: "Design: dunkel",
};

function readTheme(): Theme {
  const match = document.cookie.match(/(?:^|; )theme=(dark|light|system)/);
  return (match?.[1] as Theme | undefined) ?? "system";
}

function applyTheme(theme: Theme): void {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  // Bei "system": auf Wechsel der Systemeinstellung live reagieren
  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const cycle = () => {
    const current = theme ?? "system";
    const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]!;
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
    applyTheme(next);
    setTheme(next);
  };

  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const label = LABELS[theme ?? "system"];

  return (
    <button
      type="button"
      onClick={cycle}
      title={`${label} – klicken zum Wechseln`}
      aria-label={label}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-xl text-zinc-500 transition-colors",
        "hover:bg-zinc-100 hover:text-zinc-900 md:h-9 md:w-9",
        className,
      )}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
    </button>
  );
}
