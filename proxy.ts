import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { decodePayload, IMPERSONATION_COOKIE } from "@/lib/portal/impersonation";
import { RESERVED_SLUGS } from "@/lib/reserved-slugs";

const ADMIN_ROUTES = [
  "/app/dashboard",
  "/app/clients",
  "/app/tasks",
  "/app/time",
  "/app/finance",
  "/app/administration",
];

function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

function isPortalProtectedRoute(pathname: string): boolean {
  // Portal routes except the login page and the auth-callback page
  // (auth-callback must be reachable before the session is established)
  return (
    pathname.startsWith("/portal/") &&
    !pathname.endsWith("/login") &&
    !pathname.includes("/login?") &&
    !pathname.endsWith("/auth-callback")
  );
}

/**
 * Extracts the tenant slug from the Host header.
 * Returns null for localhost, www, or the bare base domain.
 * Example: "acme.taskflow.com" → "acme"
 */
export function getTenantSlugFromHost(host: string): string | null {
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "localhost";
  // Strip port (e.g. "acme.taskflow.com:3000" → "acme.taskflow.com")
  const hostWithoutPort = host.split(":")[0];
  if (!hostWithoutPort.includes(baseDomain)) return null;
  // Bare base domain — no subdomain present
  if (hostWithoutPort === baseDomain) return null;
  const subdomain = hostWithoutPort.split(".")[0];
  if (!subdomain || subdomain === "www") return null;
  return subdomain;
}

/** Returns true if the request carries a valid (non-expired) impersonation cookie for the given slug. */
function hasValidImpersonationCookie(request: NextRequest, urlSlug: string): boolean {
  const raw = request.cookies.get(IMPERSONATION_COOKIE)?.value;
  if (!raw) return false;
  const payload = decodePayload(raw);
  return !!payload && payload.tenantSlug === urlSlug;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Extract tenant slug from subdomain
  const host = request.headers.get("host") ?? "";
  const tenantSlug = getTenantSlugFromHost(host);

  // Inject x-tenant-slug header into every request so downstream Server
  // Components and Route Handlers can read it without re-parsing the host.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-slug", tenantSlug ?? "");

  // Always refresh the session (pass mutated headers along)
  const { supabaseResponse, user } = await updateSession(
    new NextRequest(request.url, { headers: requestHeaders, method: request.method, body: request.body })
  );

  // Helper: clone supabaseResponse but carry our custom request headers forward
  function withTenantHeader(res: NextResponse): NextResponse {
    res.headers.set("x-tenant-slug", tenantSlug ?? "");
    return res;
  }

  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "";

  // Reserved slug guard: redirect reserved subdomains back to root domain.
  if (
    tenantSlug &&
    (RESERVED_SLUGS as readonly string[]).includes(tenantSlug) &&
    !!baseDomain &&
    baseDomain !== "localhost"
  ) {
    return NextResponse.redirect(`https://${baseDomain}`);
  }

  // Root domain guard: on the bare base domain (prod only, not localhost),
  // allow only the landing page, auth routes, and API routes.
  // Anything else (e.g. /dashboard) redirects to login.
  const isRootDomain =
    !!baseDomain &&
    baseDomain !== "localhost" &&
    !tenantSlug &&
    host.split(":")[0] === baseDomain;

  if (isRootDomain) {
    const isPublicPath =
      pathname === "/" ||
      pathname.startsWith("/auth/") ||
      pathname.startsWith("/api/");
    if (!isPublicPath) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
    return withTenantHeader(supabaseResponse);
  }

  // Auth pages belong on the root domain only. Redirect any attempt to load
  // /auth/* on a tenant subdomain back to the root-domain login page so that
  // admins always authenticate on billabledesk.com, not on their subdomain.
  if (tenantSlug && pathname.startsWith("/auth/") && !!baseDomain && baseDomain !== "localhost") {
    const rootLogin = `https://${baseDomain}/auth/login`;
    return NextResponse.redirect(rootLogin);
  }

  // Admin route guard
  if (isAdminRoute(pathname)) {
    if (!user) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
    if (user.app_metadata?.role !== "admin") {
      // Authenticated client users should land on their portal, not the login page
      return NextResponse.redirect(new URL("/portal", request.url));
    }
    return withTenantHeader(supabaseResponse);
  }

  // Portal route guard
  if (isPortalProtectedRoute(pathname)) {
    // Prefer subdomain-based slug; fall back to URL path for local dev
    const urlSlug = tenantSlug ?? pathname.split("/")[2] ?? "";

    if (!user) {
      return NextResponse.redirect(
        new URL("/portal/login", request.url)
      );
    }

    // Admin impersonation: allow admins through if they have a valid cookie for this tenant
    if (user.app_metadata?.role === "admin") {
      if (hasValidImpersonationCookie(request, urlSlug)) {
        return withTenantHeader(supabaseResponse);
      }
      return NextResponse.redirect(
        new URL("/portal/login", request.url)
      );
    }

    if (user.app_metadata?.role !== "client") {
      return NextResponse.redirect(
        new URL("/portal/login", request.url)
      );
    }

    // Redirect client to their own tenant if they navigate to another
    const userSlug = user.app_metadata?.tenant_slug as string | undefined;
    if (userSlug && userSlug !== urlSlug) {
      return NextResponse.redirect(new URL("/portal", request.url));
    }
    return withTenantHeader(supabaseResponse);
  }

  return withTenantHeader(supabaseResponse);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
