import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isDevLocalhost } from "@/lib/auth/dev-localhost";
import { resolveClientIp } from "@/lib/http/client-ip";
import { createInviteRateLimitResponse } from "@/lib/invites/convite-rate-limit-http";
import { createShareRateLimitResponse } from "@/lib/setlists/share-rate-limit-http";

const PUBLIC_PREFIXES = [
  "/entrar",
  "/convite/",
  "/letras/",
  "/s/",
  "/api/auth/",
  "/api/billing/webhook",
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") {
    return true;
  }
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Ticket-authenticated submission; must not match approve/reject subpaths. */
function isPublicAccessRequestSubmission(
  pathname: string,
  method: string,
): boolean {
  return pathname === "/api/access-requests" && method === "POST";
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/convite/")) {
    const ip = resolveClientIp(request);
    const rateLimited = createInviteRateLimitResponse(ip, Date.now());
    if (rateLimited) {
      return new NextResponse(rateLimited.body, {
        status: rateLimited.status,
        headers: rateLimited.headers,
      });
    }
  }

  if (pathname.startsWith("/s/")) {
    const ip = resolveClientIp(request);
    const rateLimited = createShareRateLimitResponse(ip, Date.now());
    if (rateLimited) {
      return new NextResponse(rateLimited.body, {
        status: rateLimited.status,
        headers: rateLimited.headers,
      });
    }
  }

  if (
    isPublicPath(pathname) ||
    isPublicAccessRequestSubmission(pathname, request.method) ||
    isDevLocalhost({
      NODE_ENV: process.env.NODE_ENV,
      DEV_LOCALHOST: process.env.DEV_LOCALHOST,
    })
  ) {
    return NextResponse.next();
  }

  const hasSession = Boolean(
    getSessionCookie(request.headers, {
      cookiePrefix: "better-auth",
    }),
  );

  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
