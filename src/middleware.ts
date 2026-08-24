import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

/**
 * Erste Schutzschicht für das Admin-Dashboard (Edge).
 * Zusätzlich prüft JEDE Admin-Seite und jede Server Action die Session
 * erneut serverseitig (Defense in Depth) – die Middleware ist bewusst
 * nicht die einzige Zugriffskontrolle.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const authSecret = process.env.AUTH_SECRET;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session =
    authSecret && authSecret.length >= 32 ? await verifySessionToken(token, authSecret) : null;

  if (!session) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/admin"],
};
