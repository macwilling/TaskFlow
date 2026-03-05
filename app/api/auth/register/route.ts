import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function generateSlug(businessName: string): string {
  return (
    businessName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "consultant"
  );
}

export async function POST(request: NextRequest) {
  if (process.env.ALLOW_REGISTRATION !== "true") {
    return NextResponse.json({ error: "Registration is disabled." }, { status: 403 });
  }

  const { businessName, email, password } = await request.json();

  if (!businessName || !email || !password) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Create the auth user (auto-confirmed so they can sign in immediately)
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (userError || !userData.user) {
    const msg = userError?.message ?? "Failed to create user.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const userId = userData.user.id;

  try {
    // Generate a unique tenant slug
    let slug = generateSlug(businessName);
    const { data: existing } = await admin.from("tenants").select("slug").eq("slug", slug);
    if (existing && existing.length > 0) {
      slug = `${slug}-${Math.floor(Math.random() * 9000) + 1000}`;
    }

    // Create tenant
    const { data: tenant, error: tenantError } = await admin
      .from("tenants")
      .insert({ slug })
      .select("id")
      .single();

    if (tenantError || !tenant) {
      throw new Error(tenantError?.message ?? "Failed to create tenant.");
    }

    const tenantId: string = tenant.id;

    // Create profile
    const { error: profileError } = await admin.from("profiles").insert({
      id: userId,
      tenant_id: tenantId,
      role: "admin",
      full_name: businessName,
    });

    if (profileError) throw new Error(profileError.message);

    // Create default tenant settings
    const { error: settingsError } = await admin.from("tenant_settings").insert({
      tenant_id: tenantId,
      business_name: businessName,
    });

    if (settingsError) throw new Error(settingsError.message);

    // Set app_metadata so middleware can read role + tenant_id + tenant_slug from JWT
    const { error: metaError } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: { role: "admin", tenant_id: tenantId, tenant_slug: slug },
    });

    if (metaError) throw new Error(metaError.message);

    return NextResponse.json({ success: true });
  } catch (err) {
    // Clean up the auth user if anything downstream failed
    await admin.auth.admin.deleteUser(userId);
    const message = err instanceof Error ? err.message : "Registration failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
