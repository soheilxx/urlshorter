import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Segmentierter Pillen-Switch (z. B. Zeitraum-Auswahl): horizontal scrollbar
 * mit Scroll-Fade statt Umbruch, Aktivzustand in Primärfarbe.
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
        "scroll-x-fade flex max-w-full gap-0.5 overflow-x-auto rounded-xl border border-zinc-200 bg-surface p-0.5 shadow-sm",
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
              "whitespace-nowrap rounded-[10px] px-3 py-2 text-xs font-medium transition-colors md:py-1.5",
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
