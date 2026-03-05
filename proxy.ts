import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

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
    if (!user) {
      // Extract tenantSlug from path: /portal/[slug]/...
      const parts = pathname.split("/");
      const tenantSlug = parts[2] ?? "";
      return NextResponse.redirect(
        new URL(`/portal/${tenantSlug}/login`, request.url)
      );
    }
    if (user.app_metadata?.role !== "client") {
      const parts = pathname.split("/");
      const tenantSlug = parts[2] ?? "";
      return NextResponse.redirect(
        new URL(`/portal/${tenantSlug}/login`, request.url)
      );
    }
    // Redirect client to their own tenant if they navigate to another
    const urlSlug = pathname.split("/")[2] ?? "";
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
