"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function inviteClientToPortalAction(
  clientId: string,
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const email = (formData.get("email") as string)?.trim();
  if (!email) return { error: "Email is required." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") return { error: "Unauthorized." };

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .single();
  if (!client) return { error: "Client not found." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { role: "client", tenant_id: profile.tenant_id, client_id: clientId },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/accept-invite`,
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function finalizeInviteAction(): Promise<{
  error?: string;
  slug?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Already has a profile — just return the slug
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (existingProfile?.role === "client") {
    const slug = user.app_metadata?.tenant_slug as string | undefined;
    return slug ? { slug } : { error: "Missing tenant slug." };
  }

  // New client — create profile + portal access
  const tenantId = user.user_metadata?.tenant_id as string | undefined;
  const clientId = user.user_metadata?.client_id as string | undefined;
  if (!tenantId || !clientId) return { error: "Invalid invite." };

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("slug")
    .eq("id", tenantId)
    .single();
  if (!tenant) return { error: "Tenant not found." };

  const { error: profileError } = await admin.from("profiles").insert({
    id: user.id,
    tenant_id: tenantId,
    role: "client",
    full_name:
      (user.user_metadata?.full_name as string | undefined) ??
      user.email?.split("@")[0] ??
      "Client",
  });
  if (profileError) return { error: profileError.message };

  await admin.from("client_portal_access").insert({
    tenant_id: tenantId,
    client_id: clientId,
    user_id: user.id,
    invited_at: new Date().toISOString(),
    accepted_at: new Date().toISOString(),
  });

  await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      role: "client",
      tenant_id: tenantId,
      tenant_slug: tenant.slug,
    },
  });

  return { slug: tenant.slug };
}
