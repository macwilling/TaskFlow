import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function tenantUrl(slug: string, path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "localhost";
  if (base === "localhost") return `http://localhost:3000${path}`;
  return `https://${slug}.${base}${path}`;
}

/**
 * GET /api/auth/session-redirect
 *
 * Called after a client-side sign-in (password). Reads the session server-side,
 * resolves the tenant slug (falls back to a DB lookup if it's missing from the
 * JWT — handles pre-SaaS-migration accounts), and redirects to the right place.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN;

  if (!user) {
    const loginUrl = baseDomain && baseDomain !== "localhost"
      ? `https://${baseDomain}/auth/login`
      : "http://localhost:3000/auth/login";
    return NextResponse.redirect(loginUrl);
  }

  let tenantSlug = user.app_metadata?.tenant_slug as string | undefined;

  // Fallback: look up slug from DB (handles accounts created before the SaaS
  // migration that are missing tenant_slug in app_metadata).
  if (!tenantSlug) {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("tenant_id, tenants(slug)")
      .eq("id", user.id)
      .single();

    const tenants = profile?.tenants as { slug: string } | { slug: string }[] | null;
    tenantSlug = Array.isArray(tenants) ? tenants[0]?.slug : tenants?.slug;

    // Backfill app_metadata so subsequent sign-ins don't need the DB lookup.
    if (tenantSlug && profile?.tenant_id) {
      await admin.auth.admin.updateUserById(user.id, {
        app_metadata: {
          ...user.app_metadata,
          tenant_id: profile.tenant_id,
          tenant_slug: tenantSlug,
        },
      });
    }
  }

  if (!tenantSlug) {
    const errorUrl = baseDomain && baseDomain !== "localhost"
      ? `https://${baseDomain}/auth/login?error=auth_callback_error`
      : "http://localhost:3000/auth/login?error=auth_callback_error";
    return NextResponse.redirect(errorUrl);
  }

  if (user.app_metadata?.role === "client") {
    return NextResponse.redirect(tenantUrl(tenantSlug, "/portal"));
  }

  return NextResponse.redirect(tenantUrl(tenantSlug, "/app/dashboard"));
}
