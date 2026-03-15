import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  // Check whether this user already has a profile (returning user)
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (existingProfile) {
    const tenantSlug = user.app_metadata?.tenant_slug as string | undefined;
    if (existingProfile.role === "client") {
      // A client user who hit the admin callback — send them to their portal
      if (tenantSlug) return NextResponse.redirect(tenantUrl(tenantSlug, "/portal"));
      return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_error`);
    }
    // Admin returning user
    if (tenantSlug) return NextResponse.redirect(tenantUrl(tenantSlug, "/app/dashboard"));
    return NextResponse.redirect(`${origin}/app/dashboard`);
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

  return NextResponse.redirect(tenantUrl(slug, "/app/dashboard"));
}
