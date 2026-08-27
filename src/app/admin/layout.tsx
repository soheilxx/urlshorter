import { KeyRound, LogOut } from "lucide-react";
import Link from "next/link";
import { logoutAction } from "@/actions/auth-actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { getSession } from "@/lib/auth";
import { getPublicHostname } from "@/lib/env";
import { ROLE_LABELS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * Layout für den Admin-Bereich. Die Zugriffskontrolle für die Inhaltsseiten
 * übernimmt requireSession()/requireRole() auf jeder Seite (plus Middleware).
 * Das Layout selbst rendert die Navigation nur bei vorhandener Session – die
 * Login-Seite nutzt dasselbe Layout ohne Navigation.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-zinc-200 bg-white px-4 py-3 md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:border-r md:border-b-0 md:px-4 md:py-6">
        <div className="mb-0 flex items-center justify-between md:mb-8 md:block">
          <p className="text-sm font-bold tracking-tight text-zinc-900">
            {getPublicHostname()}
            <span className="mt-0.5 hidden text-xs font-normal text-zinc-400 md:block">
              Kurzlink-Tracking
            </span>
          </p>
          <div className="md:hidden">
            <MobileLogout />
          </div>
        </div>
        <div className="mt-3 md:mt-0 md:flex-1">
          <AdminNav role={session.role} />
        </div>
        <div className="hidden border-t border-zinc-100 pt-4 md:block">
          <p className="truncate text-xs text-zinc-500" title={session.email}>
            {session.name ?? session.email}
          </p>
          <p className="mb-2 text-[11px] font-medium tracking-wide text-zinc-400 uppercase">
            {ROLE_LABELS[session.role]}
          </p>
          <div className="flex items-center gap-1">
            <MobileLogout />
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
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}

function MobileLogout() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        Abmelden
      </button>
    </form>
  );
}
