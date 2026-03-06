import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { decodePayload, IMPERSONATION_COOKIE } from "@/lib/portal/impersonation";

const ADMIN_ROUTES = [
  "/dashboard",
  "/clients",
  "/tasks",
  "/time",
  "/invoices",
  "/reports",
  "/settings",
];

function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

function isPortalProtectedRoute(pathname: string): boolean {
  // Portal routes except the login page itself
  return (
    pathname.startsWith("/portal/") &&
    !pathname.endsWith("/login") &&
    !pathname.includes("/login?")
  );
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

  // Always refresh the session
  const { supabaseResponse, user } = await updateSession(request);

  // Registration guard — only allow if ALLOW_REGISTRATION=true
  if (pathname === "/auth/register") {
    if (process.env.ALLOW_REGISTRATION !== "true") {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
    return supabaseResponse;
  }

  // Admin route guard
  if (isAdminRoute(pathname)) {
    if (!user) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
    if (user.app_metadata?.role !== "admin") {
      // Authenticated client users should land on their portal, not the login page
      const tenantSlug = user.app_metadata?.tenant_slug as string | undefined;
      if (tenantSlug) {
        return NextResponse.redirect(new URL(`/portal/${tenantSlug}`, request.url));
      }
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
    return supabaseResponse;
  }

  // Portal route guard
  if (isPortalProtectedRoute(pathname)) {
    const urlSlug = pathname.split("/")[2] ?? "";

    if (!user) {
      return NextResponse.redirect(
        new URL(`/portal/${urlSlug}/login`, request.url)
      );
    }

    // Admin impersonation: allow admins through if they have a valid cookie for this tenant
    if (user.app_metadata?.role === "admin") {
      if (hasValidImpersonationCookie(request, urlSlug)) {
        return supabaseResponse;
      }
      return NextResponse.redirect(
        new URL(`/portal/${urlSlug}/login`, request.url)
      );
    }

    if (user.app_metadata?.role !== "client") {
      return NextResponse.redirect(
        new URL(`/portal/${urlSlug}/login`, request.url)
      );
    }

    // Redirect client to their own tenant if they navigate to another
    const userSlug = user.app_metadata?.tenant_slug as string | undefined;
    if (userSlug && userSlug !== urlSlug) {
      return NextResponse.redirect(new URL(`/portal/${userSlug}`, request.url));
    }
    return supabaseResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
