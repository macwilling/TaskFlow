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

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

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
    .select("id")
    .eq("id", user.id)
    .single();

  if (existingProfile) {
    // Returning user — proceed normally
    return NextResponse.redirect(`${origin}${next}`);
  }

  // ── First-time OAuth sign-in ──────────────────────────────────────────────
  // No profile means this is a brand-new user (e.g. Google OAuth first login).
  // Create a tenant + profile + settings, then set app_metadata.

  if (process.env.ALLOW_REGISTRATION !== "true") {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/auth/login?error=registration_disabled`);
  }

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
    app_metadata: { role: "admin", tenant_id: tenantId },
  });

  return NextResponse.redirect(`${origin}${next}`);
}
