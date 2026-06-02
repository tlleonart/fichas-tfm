import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Single-password gate (Next 16 "proxy" convention, formerly middleware).
 * Any request without a valid session cookie is redirected to /login.
 * The cookie value must equal AUTH_TOKEN (a server-only secret), so it cannot
 * be forged from the client.
 *
 * NOTE: this gate protects the Next.js UI. The Convex deployment URL is public;
 * true backend-level auth would require per-user Convex Auth (a future step).
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/login") return NextResponse.next();

  const token = req.cookies.get("osteo_auth")?.value;
  if (token && token === process.env.AUTH_TOKEN) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except the auth APIs, Next internals and static assets.
  matcher: ["/((?!api/login|api/logout|_next/static|_next/image|favicon.ico).*)"],
};
