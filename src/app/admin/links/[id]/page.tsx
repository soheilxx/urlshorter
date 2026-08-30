import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toggleShortLinkActiveAction } from "@/actions/link-actions";
import { ClicksPerDayChart } from "@/components/admin/charts";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { CopyButton } from "@/components/admin/copy-button";
import { LinkForm } from "@/components/admin/link-form";
import { QrCard } from "@/components/admin/qr-card";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { canManageLinks } from "@/lib/permissions";
import { getClicksPerDay, getOverviewStats, resolveRange } from "@/lib/stats";
import { formatBerlinDate, formatNumber, formatPercent } from "@/lib/utils";

export const metadata: Metadata = { title: "Kurzlink-Details" };
export const dynamic = "force-dynamic";

export default async function LinkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const canManage = canManageLinks(session.role);
  const { id } = await params;

  const link = await prisma.shortLink.findUnique({
    where: { id },
    include: { destination: true },
  });
  if (!link) notFound();

  const [destinations, range] = [
    await prisma.destination.findMany({
      where: { OR: [{ active: true }, { id: link.destinationId }] },
      select: { id: true, name: true, host: true, active: true },
      orderBy: { name: "asc" },
    }),
    resolveRange("30d"),
  ];

  const scope = {
    from: range.from,
    to: range.to,
    fromDay: range.fromDay,
    toDay: range.toDay,
    botFilter: "human" as const,
    shortLinkId: link.id,
  };
  const [stats, perDay] = await Promise.all([getOverviewStats(scope), getClicksPerDay(scope)]);

  const fullUrl = `${getEnv().PUBLIC_BASE_URL}/${link.code}`;
  const expired = link.expiresAt !== null && link.expiresAt.getTime() <= Date.now();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">
              <code className="font-mono">/{link.code}</code>
            </h1>
            {expired ? (
              <Badge variant="warning">Abgelaufen</Badge>
            ) : link.active && link.destination.active ? (
              <Badge variant="success">Aktiv</Badge>
            ) : (
              <Badge variant="muted">Inaktiv</Badge>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1 text-sm text-zinc-500">
            <span className="break-all font-mono">{fullUrl}</span>
            <CopyButton value={fullUrl} />
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Ziel:{" "}
            <a
              href={link.destination.url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-zinc-700 underline hover:text-zinc-900"
            >
              {link.destination.url}
            </a>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/clicks?linkId=${link.id}`}>
            <Button variant="secondary" size="sm">
              Klicks anzeigen
            </Button>
          </Link>
          {canManage ? (
            <form action={toggleShortLinkActiveAction}>
              <input type="hidden" name="id" value={link.id} />
              <input type="hidden" name="active" value={link.active ? "false" : "true"} />
              {link.active ? (
                <ConfirmSubmitButton confirmText="Wirklich deaktivieren?">
                  Deaktivieren
                </ConfirmSubmitButton>
              ) : (
                <Button type="submit" variant="secondary" size="sm">
                  Reaktivieren
                </Button>
              )}
            </form>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Klicks (30 Tage)" value={formatNumber(stats.humanClicks)} />
        <StatCard label="Unique Visitors" value={formatNumber(stats.uniqueVisitors)} />
        <StatCard label="Bots" value={formatNumber(stats.botClicks)} />
        <StatCard label="Tracking angestoßen" value={formatPercent(stats.trackingFiredRate)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Klicks pro Tag (30 Tage, ohne Bots)</CardTitle>
        </CardHeader>
        <CardContent>
          <ClicksPerDayChart data={perDay} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>QR-Code</CardTitle>
        </CardHeader>
        <CardContent>
          <QrCard url={fullUrl} code={link.code} />
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
        <CardHeader>
          <CardTitle>Link bearbeiten</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-zinc-400">
            Der Kurzcode /{link.code} ist unveränderlich. Erstellt am{" "}
            {formatBerlinDate(link.createdAt)}, zuletzt geändert am{" "}
            {formatBerlinDate(link.updatedAt)}.
          </p>
          <LinkForm
            destinations={destinations}
            mode="edit"
            initialValues={{
              id: link.id,
              destinationId: link.destinationId,
              name: link.name,
              source: link.source,
              medium: link.medium ?? undefined,
              campaign: link.campaign ?? undefined,
              content: link.content ?? undefined,
              note: link.note ?? undefined,
              expiresAt: link.expiresAt
                ? new Intl.DateTimeFormat("en-CA", {
                    timeZone: "Europe/Berlin",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  }).format(new Date(link.expiresAt.getTime() - 1))
                : undefined,
            }}
          />
        </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
