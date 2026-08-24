import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { addDays, berlinDayStartUtc, DATE_STRING_PATTERN } from "@/lib/date-range";

/**
 * Gemeinsames Filter-Parsing für die Klicktabelle und den CSV-Export.
 * Alle Filter werden serverseitig validiert und in eine Prisma-Where-Klausel
 * übersetzt (serverseitige Pagination, kein Laden der Gesamttabelle).
 */

export const CLICK_PAGE_SIZE = 50;

const filterSchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).catch(1),
  sort: z.enum(["ts", "code", "source", "campaign", "country"]).catch("ts"),
  dir: z.enum(["asc", "desc"]).catch("desc"),
  from: z.string().regex(DATE_STRING_PATTERN).optional().catch(undefined),
  to: z.string().regex(DATE_STRING_PATTERN).optional().catch(undefined),
  source: z.string().max(200).optional().catch(undefined),
  campaign: z.string().max(200).optional().catch(undefined),
  linkId: z.string().max(64).optional().catch(undefined),
  bot: z.enum(["human", "bot", "all"]).catch("human"),
  device: z.string().max(32).optional().catch(undefined),
  q: z.string().max(200).optional().catch(undefined),
});

export type ClickFilters = z.infer<typeof filterSchema>;

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value === "" ? undefined : value;
}

export function parseClickFilters(searchParams: SearchParams): ClickFilters {
  return filterSchema.parse({
    page: first(searchParams.page),
    sort: first(searchParams.sort),
    dir: first(searchParams.dir),
    from: first(searchParams.from),
    to: first(searchParams.to),
    source: first(searchParams.source),
    campaign: first(searchParams.campaign),
    linkId: first(searchParams.linkId),
    bot: first(searchParams.bot),
    device: first(searchParams.device),
    q: first(searchParams.q),
  });
}

export function buildClickWhere(filters: ClickFilters): Prisma.ClickEventWhereInput {
  const where: Prisma.ClickEventWhereInput = {};

  if (filters.bot === "human") where.isBot = false;
  else if (filters.bot === "bot") where.isBot = true;

  if (filters.from || filters.to) {
    where.ts = {};
    if (filters.from) where.ts.gte = berlinDayStartUtc(filters.from);
    if (filters.to) where.ts.lt = berlinDayStartUtc(addDays(filters.to, 1));
  }
  if (filters.source) where.source = filters.source;
  if (filters.campaign) where.campaign = filters.campaign;
  if (filters.linkId) where.shortLinkId = filters.linkId;
  if (filters.device) where.deviceType = filters.device;

  if (filters.q) {
    where.OR = [
      { code: { contains: filters.q, mode: "insensitive" } },
      { linkName: { contains: filters.q, mode: "insensitive" } },
      { source: { contains: filters.q, mode: "insensitive" } },
      { campaign: { contains: filters.q, mode: "insensitive" } },
      { referrer: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  return where;
}

export function buildClickOrderBy(
  filters: ClickFilters,
): Prisma.ClickEventOrderByWithRelationInput[] {
  const dir = filters.dir;
  switch (filters.sort) {
    case "code":
      return [{ code: dir }, { ts: "desc" }];
    case "source":
      return [{ source: dir }, { ts: "desc" }];
    case "campaign":
      return [{ campaign: dir }, { ts: "desc" }];
    case "country":
      return [{ country: dir }, { ts: "desc" }];
    case "ts":
    default:
      return [{ ts: dir }, { id: dir }];
  }
}
