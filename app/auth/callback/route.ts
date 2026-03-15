import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantSlugFromHost } from "@/proxy";

function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "consultant"
  );
}

function tenantUrl(slug: string, path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "localhost";
  if (base === "localhost") return `http://localhost:3000${path}`;
  return `https://${slug}.${base}${path}`;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_error`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_error`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_error`);
  }

  // Detect portal vs admin callback via subdomain
  const host = request.headers.get("host") ?? "";
  const subdomain = getTenantSlugFromHost(host);
  const isPortalCallback = !!subdomain;

  // Check whether this user already has a profile (returning user)
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (existingProfile) {
    const tenantSlug = user.app_metadata?.tenant_slug as string | undefined;
    if (existingProfile.role === "client") {
      if (tenantSlug) return NextResponse.redirect(tenantUrl(tenantSlug, "/portal"));
      return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_error`);
    }
    // Admin returning user
    if (tenantSlug) return NextResponse.redirect(tenantUrl(tenantSlug, "/dashboard"));
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  // ── Portal first-time sign-in (OTP magic link OR Google OAuth) ──────────
  // No profile + callback arrived on a tenant subdomain.
  // Match the user's email to an existing clients record to authorize access.
  if (isPortalCallback) {
    const portalSlug = subdomain;
    const admin = createAdminClient();

    const { data: tenant } = await admin
      .from("tenants")
      .select("id, slug")
      .eq("slug", portalSlug)
      .single();
    if (!tenant) {
      await supabase.auth.signOut();
      return NextResponse.redirect(
        `${origin}/portal/login?error=auth_callback_error`
      );
    }

    const { data: client } = await admin
      .from("clients")
      .select("id")
      .eq("email", user.email)
      .eq("tenant_id", tenant.id)
      .single();
    if (!client) {
      await supabase.auth.signOut();
      return NextResponse.redirect(
        `${origin}/portal/login?error=not_invited`
      );
    }

    const displayName =
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email?.split("@")[0] ??
      "Client";

    await admin.from("profiles").insert({
      id: user.id,
      tenant_id: tenant.id,
      role: "client",
      full_name: displayName,
    });

    // Update existing pending row if present (OTP invite flow),
    // otherwise insert a new row (e.g. Google OAuth without prior invite).
    const { data: existingAccess } = await admin
      .from("client_portal_access")
      .select("id")
      .eq("client_id", client.id)
      .eq("tenant_id", tenant.id)
      .maybeSingle();

    if (existingAccess) {
      await admin
        .from("client_portal_access")
        .update({ user_id: user.id, accepted_at: new Date().toISOString() })
        .eq("client_id", client.id)
        .eq("tenant_id", tenant.id);
    } else {
      await admin.from("client_portal_access").insert({
        tenant_id: tenant.id,
        client_id: client.id,
        user_id: user.id,
        accepted_at: new Date().toISOString(),
      });
    }

    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: {
        role: "client",
        tenant_id: tenant.id,
        tenant_slug: tenant.slug,
      },
    });
    return NextResponse.redirect(tenantUrl(tenant.slug, "/portal"));
  }

  // ── First-time admin OAuth sign-in ───────────────────────────────────────
  // No profile + callback on root domain → new admin user via Google OAuth.
  // Create a tenant + profile + settings, then redirect to tenant subdomain.
  const admin = createAdminClient();
  const displayName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split("@")[0] ??
    "Consultant";

  let slug = generateSlug(displayName);
  const { data: existing } = await admin
    .from("tenants")
    .select("slug")
    .eq("slug", slug);
  if (existing && existing.length > 0) {
    slug = `${slug}-${Math.floor(Math.random() * 9000) + 1000}`;
  }

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .insert({ slug })
    .select("id")
    .single();

  if (tenantError || !tenant) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_error`);
  }

  const tenantId: string = tenant.id;

  await admin.from("profiles").insert({
    id: user.id,
    tenant_id: tenantId,
    role: "admin",
    full_name: displayName,
  });

  await admin.from("tenant_settings").insert({
    tenant_id: tenantId,
    business_name: displayName,
  });

  await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { role: "admin", tenant_id: tenantId, tenant_slug: slug },
  });

  return NextResponse.redirect(tenantUrl(slug, "/dashboard"));
}
