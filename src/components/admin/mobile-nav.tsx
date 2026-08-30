"use client";

import {
  Gift,
  Globe2,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  Link2,
  LogOut,
  MonitorSmartphone,
  MousePointerClick,
  Settings,
  Target,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { cn } from "@/lib/utils";

/**
 * Mobile Navigation (< md): fixe Bottom-Tab-Bar mit den vier Hauptbereichen
 * plus „Mehr“-Tab, der ein Bottom-Sheet mit den restlichen (rollengefilterten)
 * Bereichen, Konto-Aktionen und Theme-Umschalter öffnet.
 * Desktop nutzt weiterhin die Sidebar (AdminNav).
 */

const ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  analytics: Globe2,
  links: Link2,
  amazon: TrendingUp,
  destinations: Target,
  clicks: MousePointerClick,
  websites: MonitorSmartphone,
  gewinnspiel: Gift,
  users: Users,
  settings: Settings,
};

const MAIN_TABS = [
  { href: "/admin", label: "Übersicht", icon: "overview", exact: true },
  { href: "/admin/analytics", label: "Analytics", icon: "analytics", exact: false },
  { href: "/admin/links", label: "Kurzlinks", icon: "links", exact: false },
  { href: "/admin/amazon", label: "Amazon", icon: "amazon", exact: false },
];

export interface MoreNavItem {
  href: string;
  label: string;
  icon: string;
}

export function MobileTabBar({
  moreItems,
  accountName,
  roleLabel,
  logoutAction,
}: {
  moreItems: MoreNavItem[];
  accountName: string;
  roleLabel: string;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Sheet bei Navigation schließen + Escape-Handling + Scroll-Lock
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [sheetOpen]);

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);
  const moreActive = moreItems.some((item) => pathname.startsWith(item.href));

  return (
    <>
      {/* Bottom-Tab-Bar */}
      <nav
        aria-label="Hauptnavigation (mobil)"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="grid grid-cols-5">
          {MAIN_TABS.map((tab) => {
            const Icon = ICONS[tab.icon]!;
            const active = isActive(tab.href, tab.exact);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-zinc-500 hover:text-zinc-800",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" strokeWidth={active ? 2.4 : 2} />
                {tab.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
              moreActive || sheetOpen ? "text-primary" : "text-zinc-500 hover:text-zinc-800",
            )}
          >
            <LayoutGrid
              className="h-5 w-5"
              aria-hidden="true"
              strokeWidth={moreActive || sheetOpen ? 2.4 : 2}
            />
            Mehr
          </button>
        </div>
      </nav>

      {/* „Mehr“-Bottom-Sheet */}
      {sheetOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Weitere Bereiche"
          className="fixed inset-0 z-50 md:hidden"
        >
          <button
            type="button"
            aria-label="Menü schließen"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-zinc-200 bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-900">Mehr</p>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Schließen"
                autoFocus
                className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {moreItems.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {moreItems.map((item) => {
                  const Icon = ICONS[item.icon] ?? LayoutGrid;
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border text-xs font-medium transition-colors",
                        active
                          ? "border-primary/30 bg-primary-soft text-primary"
                          : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}

            {/* Konto-Bereich */}
            <div className="mt-4 rounded-2xl border border-zinc-200 p-3">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary"
                >
                  {accountName.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">{accountName}</p>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    {roleLabel}
                  </p>
                </div>
                <ThemeToggle />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link
                  href="/admin/account"
                  className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  Passwort
                </Link>
                <form action={logoutAction} className="contents">
                  <button
                    type="submit"
                    className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Abmelden
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
