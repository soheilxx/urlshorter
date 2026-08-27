"use client";

import {
  Globe2,
  LayoutDashboard,
  Link2,
  MousePointerClick,
  Settings,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { canManageSettings, canManageUsers, type Role } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/** Navigationseinträge; Sichtbarkeit pro Rolle über visible(role). */
const NAV_ITEMS = [
  { href: "/admin", label: "Übersicht", icon: LayoutDashboard, exact: true, visible: () => true },
  { href: "/admin/analytics", label: "Analytics", icon: Globe2, exact: false, visible: () => true },
  { href: "/admin/links", label: "Kurzlinks", icon: Link2, exact: false, visible: () => true },
  { href: "/admin/destinations", label: "Ziele", icon: Target, exact: false, visible: () => true },
  {
    href: "/admin/clicks",
    label: "Klicks",
    icon: MousePointerClick,
    exact: false,
    visible: () => true,
  },
  {
    href: "/admin/users",
    label: "Benutzer",
    icon: Users,
    exact: false,
    visible: (role: Role) => canManageUsers(role),
  },
  {
    href: "/admin/settings",
    label: "Einstellungen",
    icon: Settings,
    exact: false,
    visible: (role: Role) => canManageSettings(role),
  },
];

export function AdminNav({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Hauptnavigation" className="flex gap-1 md:flex-col">
      {NAV_ITEMS.filter((item) => item.visible(role)).map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
