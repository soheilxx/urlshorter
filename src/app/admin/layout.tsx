import { KeyRound, LogOut } from "lucide-react";
import Link from "next/link";
import { logoutAction } from "@/actions/auth-actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { BrandMark, BrandWordmark } from "@/components/admin/brand";
import {
  CommandPalette,
  CommandPaletteTrigger,
  type PaletteEntry,
} from "@/components/admin/command-palette";
import { MobileTabBar, type MoreNavItem } from "@/components/admin/mobile-nav";
import { PwaInstallBanner } from "@/components/admin/pwa-install-banner";
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
    items.push({ href: "/admin/gutscheine", label: "Gutscheine", icon: "gutscheine" });
    items.push({ href: "/admin/users", label: "Benutzer", icon: "users" });
  }
  if (canManageSettings(role)) {
    items.push({ href: "/admin/settings", label: "Einstellungen", icon: "settings" });
  }
  return items;
}

/** Einträge der Befehls-Palette (Cmd/Ctrl-K), rollengefiltert. */
function buildPaletteEntries(role: Role): PaletteEntry[] {
  const pages: PaletteEntry[] = [
    { href: "/admin", label: "Übersicht", group: "Seiten" },
    { href: "/admin/analytics", label: "Analytics", group: "Seiten" },
    { href: "/admin/links", label: "Kurzlinks", group: "Seiten" },
    { href: "/admin/destinations", label: "Ziele", group: "Seiten" },
    { href: "/admin/clicks", label: "Klicks", group: "Seiten" },
    { href: "/admin/amazon", label: "Amazon Rankings", group: "Seiten" },
    { href: "/admin/amazon/top25", label: "Amazon Top 25", group: "Seiten" },
    { href: "/admin/account", label: "Mein Konto", group: "Seiten" },
  ];
  if (canManageLinks(role)) {
    pages.push({ href: "/admin/websites", label: "Websites", group: "Seiten" });
    pages.push({ href: "/admin/links/new", label: "Neuer Kurzlink", group: "Aktionen" });
    pages.push({ href: "/admin/links/bulk", label: "Mehrere Links erstellen", group: "Aktionen" });
    pages.push({ href: "/admin/destinations", label: "Neues Ziel anlegen", group: "Aktionen" });
  }
  if (canManageUsers(role)) {
    pages.push({ href: "/admin/gewinnspiel", label: "Gewinnspiel", group: "Seiten" });
    pages.push({ href: "/admin/gutscheine", label: "Gutscheine", group: "Seiten" });
    pages.push({ href: "/admin/users", label: "Benutzer", group: "Seiten" });
  }
  if (canManageSettings(role)) {
    pages.push({ href: "/admin/settings", label: "Einstellungen", group: "Seiten" });
    pages.push({ href: "/admin/amazon/einstellungen", label: "Amazon-Einstellungen", group: "Seiten" });
  }
  return pages;
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
        <p className="flex items-center gap-2 text-sm">
          <BrandMark className="h-7 w-7 rounded-lg [&>svg]:h-3.5 [&>svg]:w-3.5" />
          <BrandWordmark className="text-[15px]" />
        </p>
        <span className="flex items-center gap-1">
          <CommandPaletteTrigger variant="icon" />
          <ThemeToggle />
        </span>
      </header>

      {/* Desktop-Sidebar */}
      <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:border-r md:border-zinc-200 md:bg-surface md:px-4 md:py-6">
        <div className="mb-8 flex items-center gap-2.5">
          <BrandMark />
          <p className="min-w-0 text-sm">
            <BrandWordmark className="block truncate text-base leading-tight" />
            <span className="mt-0.5 block truncate text-xs font-normal text-zinc-400">
              {hostname}
            </span>
          </p>
        </div>
        <CommandPaletteTrigger variant="field" />
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
      {/* overflow-x-clip: einzelne ausreißende Elemente können die Seite
          nie mehr horizontal verschieben (Schutznetz zusätzlich zu den
          responsiven Fixes der Inhalte). */}
      <main className="min-w-0 flex-1 overflow-x-clip px-4 py-5 pb-24 md:px-8 md:py-8 md:pb-8">
        <div className="mx-auto max-w-screen-2xl">{children}</div>
      </main>

      <MobileTabBar
        moreItems={buildMoreItems(session.role)}
        accountName={accountName}
        roleLabel={ROLE_LABELS[session.role]}
        logoutAction={logoutAction}
      />

      <CommandPalette entries={buildPaletteEntries(session.role)} />
      <PwaInstallBanner />
    </div>
  );
}
