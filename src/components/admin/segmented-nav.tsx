import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Segmentierter Pillen-Switch (z. B. Zeitraum-Auswahl). Bricht auf schmalen
 * Screens in mehrere Zeilen um – KEIN horizontales Scrollen (UX-Vorgabe).
 */
export interface SegmentedOption {
  key: string;
  label: string;
  href: string;
}

export function SegmentedNav({
  options,
  activeKey,
  ariaLabel,
  className,
}: {
  options: SegmentedOption[];
  activeKey: string;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "flex max-w-full flex-wrap gap-0.5 rounded-xl border border-zinc-200 bg-surface p-0.5 shadow-sm",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.key === activeKey;
        return (
          <Link
            key={option.key}
            href={option.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex-1 whitespace-nowrap rounded-[10px] px-3 py-2 text-center text-xs font-medium transition-colors md:flex-none md:py-1.5",
              active
                ? "bg-primary text-white"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
