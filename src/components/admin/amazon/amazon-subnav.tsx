"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/** Unternavigation des Amazon-Ranking-Moduls (auf allen Modul-Seiten). */
const ITEMS = [
  { href: "/admin/amazon", label: "Übersicht", exact: true, adminOnly: false },
  { href: "/admin/amazon/buch", label: "Buchdetail", exact: false, adminOnly: false },
  { href: "/admin/amazon/top25", label: "Top 25", exact: false, adminOnly: false },
  { href: "/admin/amazon/kategorien", label: "Kategorien", exact: false, adminOnly: false },
  { href: "/admin/amazon/provider", label: "Provider", exact: false, adminOnly: false },
  { href: "/admin/amazon/einstellungen", label: "Einstellungen", exact: false, adminOnly: true },
];

export function AmazonSubNav({ role }: { role: Role }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Amazon-Rankings-Navigation"
      className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-surface p-1 shadow-sm"
    >
      {ITEMS.filter((item) => !item.adminOnly || role === "ADMIN").map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
