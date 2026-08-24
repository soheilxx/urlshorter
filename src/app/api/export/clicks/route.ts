import { getAdminSession } from "@/lib/auth";
import { parseClickFilters } from "@/lib/click-filters";
import { streamClicksCsv } from "@/lib/csv";
import { todayBerlin } from "@/lib/date-range";

/**
 * CSV-Export der aktuell gefilterten Klickdaten.
 * Nur für authentifizierte Administratoren.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const session = await getAdminSession();
  if (!session) {
    return new Response("Nicht autorisiert.", { status: 401 });
  }

  const url = new URL(request.url);
  const params: Record<string, string | undefined> = {};
  for (const [key, value] of url.searchParams.entries()) {
    params[key] = value;
  }
  const filters = parseClickFilters(params);

  const stream = streamClicksCsv(filters);
  const filename = `klicks-export-${todayBerlin()}.csv`;

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
