"use client";

import {
  Gift,
  Globe2,
  LayoutDashboard,
  Link2,
  MonitorSmartphone,
  MousePointerClick,
  Settings,
  Target,
  Ticket,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { canManageLinks, canManageSettings, canManageUsers, type Role } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/**
 * Desktop-Sidebar-Navigation (≥ md). Mobil übernimmt die Bottom-Tab-Bar
 * (components/admin/mobile-nav.tsx). Sichtbarkeit pro Rolle über visible(role);
 * Links ohne Berechtigung erscheinen nicht im DOM.
 */
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
    href: "/admin/amazon",
    label: "Amazon Rankings",
    icon: TrendingUp,
    exact: false,
    visible: () => true,
  },
  {
    href: "/admin/websites",
    label: "Websites",
    icon: MonitorSmartphone,
    exact: false,
    visible: (role: Role) => canManageLinks(role),
  },
  {
    href: "/admin/gewinnspiel",
    label: "Gewinnspiel",
    icon: Gift,
    exact: false,
    visible: (role: Role) => canManageUsers(role),
  },
  {
    href: "/admin/gutscheine",
    label: "Gutscheine",
    icon: Ticket,
    exact: false,
    visible: (role: Role) => canManageUsers(role),
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
    <nav aria-label="Hauptnavigation" className="flex flex-col gap-1">
      {NAV_ITEMS.filter((item) => item.visible(role)).map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary-soft font-semibold text-primary"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
