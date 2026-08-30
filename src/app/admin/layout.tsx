import { KeyRound, LinkIcon, LogOut } from "lucide-react";
import Link from "next/link";
import { logoutAction } from "@/actions/auth-actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { MobileTabBar, type MoreNavItem } from "@/components/admin/mobile-nav";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { getSession } from "@/lib/auth";
import { getPublicHostname } from "@/lib/env";
import {
  canManageLinks,
  canManageSettings,
  canManageUsers,
  ROLE_LABELS,
  type Role,
} from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * Admin-Shell „Redesign 2.0“:
 * - Desktop (≥ md): Sidebar mit Hauptnavigation + Nutzerkarte
 * - Mobil (< md): Sticky-Topbar + Bottom-Tab-Bar mit „Mehr“-Sheet
 * Die Zugriffskontrolle übernehmen requireSession()/requireRole() pro Seite;
 * das Layout rendert die Navigation nur bei vorhandener Session.
 */

/** Bereiche, die mobil im „Mehr“-Sheet liegen (rollengefiltert, serverseitig). */
function buildMoreItems(role: Role): MoreNavItem[] {
  const items: MoreNavItem[] = [
    { href: "/admin/destinations", label: "Ziele", icon: "destinations" },
    { href: "/admin/clicks", label: "Klicks", icon: "clicks" },
  ];
  if (canManageLinks(role)) {
    items.push({ href: "/admin/websites", label: "Websites", icon: "websites" });
  }
  if (canManageUsers(role)) {
    items.push({ href: "/admin/gewinnspiel", label: "Gewinnspiel", icon: "gewinnspiel" });
    items.push({ href: "/admin/users", label: "Benutzer", icon: "users" });
  }
  if (canManageSettings(role)) {
    items.push({ href: "/admin/settings", label: "Einstellungen", icon: "settings" });
  }
  return items;
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    return <div className="min-h-screen">{children}</div>;
  }

  const hostname = getPublicHostname();
  const accountName = session.name ?? session.email;

  return (
    <div className="min-h-screen md:flex">
      {/* Mobile Topbar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200 bg-surface/95 px-4 backdrop-blur md:hidden">
        <p className="flex items-center gap-2 text-sm font-bold tracking-tight text-zinc-900">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white"
          >
            <LinkIcon className="h-3.5 w-3.5" />
          </span>
          {hostname}
        </p>
        <ThemeToggle />
      </header>

      {/* Desktop-Sidebar */}
      <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:border-r md:border-zinc-200 md:bg-surface md:px-4 md:py-6">
        <div className="mb-8 flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white"
          >
            <LinkIcon className="h-4 w-4" />
          </span>
          <p className="min-w-0 text-sm font-bold tracking-tight text-zinc-900">
            <span className="block truncate">{hostname}</span>
            <span className="mt-0.5 block text-xs font-normal text-zinc-400">
              Kurzlink-Tracking
            </span>
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <AdminNav role={session.role} />
        </div>
        <div className="border-t border-zinc-100 pt-4">
          <div className="flex items-center gap-2.5 rounded-xl px-1 py-1">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary"
            >
              {accountName.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-zinc-700" title={session.email}>
                {accountName}
              </p>
              <p className="text-[10px] font-medium tracking-wide text-zinc-400 uppercase">
                {ROLE_LABELS[session.role]}
              </p>
            </div>
            <ThemeToggle />
          </div>
          <div className="mt-2 flex items-center gap-1">
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Abmelden
              </button>
            </form>
            <Link
              href="/admin/account"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              Passwort
            </Link>
          </div>
        </div>
      </aside>

      {/* Inhalt (mobil mit Platz für die Tab-Bar) */}
      <main className="min-w-0 flex-1 px-4 py-5 pb-24 md:px-8 md:py-8 md:pb-8">
        <div className="mx-auto max-w-screen-2xl">{children}</div>
      </main>

      <MobileTabBar
        moreItems={buildMoreItems(session.role)}
        accountName={accountName}
        roleLabel={ROLE_LABELS[session.role]}
        logoutAction={logoutAction}
      />
    </div>
  );
}
