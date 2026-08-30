import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * TRACK.SITE-Markenzeichen (Vorbild fast.site): blaues App-Icon +
 * Wortmarke im Display-Font, ".SITE" im Primärblau.
 */

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm",
        className,
      )}
    >
      <Activity className="h-4 w-4" strokeWidth={2.5} />
    </span>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display font-bold tracking-tight", className)}>
      <span className="text-zinc-900">TRACK</span>
      <span className="text-primary">.SITE</span>
    </span>
  );
}
