"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Grant portal access to a client (first invite) OR resend an access link.
 *
 * On first call: creates a pending client_portal_access row (invited_at set,
 * user_id + accepted_at null), generates a magic link via the Supabase admin
 * API, and sends a branded invite email via Resend.
 *
 * On subsequent calls (resend): skips row creation and just regenerates a new
 * magic link + sends the email again.
 */
export async function sendPortalSignInLinkAction(
  clientId: string,
  _prev: { error?: string; success?: boolean } | null
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") return { error: "Unauthorized." };

  const { data: client } = await supabase
    .from("clients")
    .select("email, name")
    .eq("id", clientId)
    .single();
  if (!client?.email) return { error: "Client email not found." };

  const admin = createAdminClient();

  const { data: tenant } = await admin
    .from("tenants")
    .select("slug")
    .eq("id", profile.tenant_id)
    .single();
  if (!tenant) return { error: "Tenant not found." };

  const { data: settings } = await admin
    .from("tenant_settings")
    .select("business_name")
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  const businessName = (settings?.business_name as string | null) ?? "Your consultant";

  // Insert pending access row on first grant; skip on resend
  const { data: existingAccess } = await admin
    .from("client_portal_access")
    .select("id")
    .eq("client_id", clientId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (!existingAccess) {
    await admin.from("client_portal_access").insert({
      tenant_id: profile.tenant_id,
      client_id: clientId,
      invited_at: new Date().toISOString(),
      // user_id and accepted_at are intentionally null — populated on first login
    });
  }

  // Generate magic link without sending Supabase's default email
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: client.email,
    options: {
      redirectTo: `${appUrl}/portal/${tenant.slug}/auth-callback`,
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actionLink = (linkData as any)?.properties?.action_link as string | undefined;
  if (linkError || !actionLink) {
    return { error: (linkError as Error | null)?.message ?? "Failed to generate sign-in link." };
  }

  // Send branded invite email via Resend
  const resend = new Resend(process.env.RESEND_API_KEY);
  const clientName = (client.name as string | null) ?? "there";
  const subject = `Your ${businessName} portal is ready`;
  const html = `
    <p>Hi ${escapeHtml(clientName)},</p>
    <p>${escapeHtml(businessName)} has given you access to your client portal.</p>
    <p style="margin:24px 0">
      <a href="${actionLink}" style="background:#0969da;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
        Access your portal
      </a>
    </p>
    <p style="color:#6e7781;font-size:12px">
      This link expires in 1 hour. If you did not expect this email, you can ignore it.
    </p>
  `;

  const { data: sendData, error: sendError } = await resend.emails.send({
    from: `${businessName} <noreply@${process.env.RESEND_DOMAIN ?? "taskflow.dev"}>`,
    to: client.email,
    subject,
    html,
  });

  await admin.from("email_log").insert({
    tenant_id: profile.tenant_id,
    to_email: client.email,
    subject,
    type: "portal_invite",
    related_id: clientId,
    resend_id: sendData?.id ?? null,
    status: sendError ? "failed" : "sent",
    error_message: (sendError as Error | null)?.message ?? null,
  });

  if (sendError) return { error: (sendError as Error).message };
  return { success: true };
}

// ─── Finalize portal session (called client-side after hash-fragment auth) ───
//
// Admin-generated magic links use the OTP/implicit flow: Supabase redirects
// back with access_token in the URL hash, NOT a code parameter.  The browser
// Supabase client detects the hash, stores the session in cookies, and then
// the PortalAuthCallbackClient calls this action to create the profile row
// (first-time sign-in) or verify the existing one (returning user).

export async function finalizePortalSessionAction(
  tenantSlug: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "No session found." };

  // Check for an existing profile (returning user)
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (existingProfile) {
    if (existingProfile.role !== "client") {
      await supabase.auth.signOut();
      return { error: "Unauthorized." };
    }
    // Returning client — always refresh last_seen_at.
    // Also patch accepted_at if it's somehow null (e.g. prior partial setup).
    const now = new Date().toISOString();
    const adminClient = createAdminClient();
    const { data: accessRow } = await adminClient
      .from("client_portal_access")
      .select("accepted_at")
      .eq("user_id", user.id)
      .maybeSingle();
    await adminClient
      .from("client_portal_access")
      .update({
        last_seen_at: now,
        ...(accessRow && !accessRow.accepted_at ? { accepted_at: now } : {}),
      })
      .eq("user_id", user.id);
    return {};
  }

  // First-time sign-in: set up the portal account
  const admin = createAdminClient();

  const { data: tenant } = await admin
    .from("tenants")
    .select("id, slug")
    .eq("slug", tenantSlug)
    .single();

  if (!tenant) {
    await supabase.auth.signOut();
    return { error: "Tenant not found." };
  }

  // Match the user's email to a clients record in this tenant
  const { data: client } = await admin
    .from("clients")
    .select("id")
    .eq("email", user.email!)
    .eq("tenant_id", tenant.id)
    .single();

  if (!client) {
    await supabase.auth.signOut();
    return { error: "not_invited" };
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

  // Update the pending access row (if it exists) or create a new one
  const { data: existingAccess } = await admin
    .from("client_portal_access")
    .select("id")
    .eq("client_id", client.id)
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  const now = new Date().toISOString();
  if (existingAccess) {
    await admin
      .from("client_portal_access")
      .update({ user_id: user.id, accepted_at: now, last_seen_at: now })
      .eq("client_id", client.id)
      .eq("tenant_id", tenant.id);
  } else {
    await admin.from("client_portal_access").insert({
      tenant_id: tenant.id,
      client_id: client.id,
      user_id: user.id,
      accepted_at: now,
      last_seen_at: now,
    });
  }

  await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      role: "client",
      tenant_id: tenant.id,
      tenant_slug: tenant.slug,
    },
  });

  return {};
}

// ─── Create task from portal (client role) ───────────────────────────────────

/**
 * Allows a portal client to submit a new task request.
 * tenantSlug is bound at call-site via .bind() so we can redirect back to the portal.
 */
export async function createPortalTaskAction(
  tenantSlug: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "client") {
    return { error: "Unauthorized." };
  }

  const tenantId = user.app_metadata?.tenant_id as string | undefined;
  if (!tenantId) return { error: "No tenant found." };

  const { data: access } = await supabase
    .from("client_portal_access")
    .select("client_id")
    .eq("user_id", user.id)
    .single();

  if (!access?.client_id) return { error: "Portal access not found." };

  const title = (formData.get("title") as string)?.trim();
  if (!title) return { error: "Title is required." };

  const description = (formData.get("description") as string)?.trim() || null;
  const priority = (formData.get("priority") as string) || "medium";
  const dueDateRaw = (formData.get("due_date") as string)?.trim();
  const due_date = dueDateRaw || null;

  const admin = createAdminClient();

  const { data: taskNumber, error: numError } = await admin.rpc(
    "next_task_number_for_client",
    { p_client_id: access.client_id }
  );
  if (numError) return { error: numError.message };

  const { data, error } = await admin
    .from("tasks")
    .insert({
      tenant_id: tenantId,
      client_id: access.client_id,
      title,
      description,
      priority,
      due_date,
      task_number: taskNumber,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to create task." };

  revalidatePath(`/portal/${tenantSlug}`);
  redirect(`/portal/${tenantSlug}/tasks/${data.id}`);
}

export async function revokePortalAccessAction(
  clientId: string
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") return { error: "Unauthorized." };

  const admin = createAdminClient();
  const { data: access } = await admin
    .from("client_portal_access")
    .select("user_id")
    .eq("client_id", clientId)
    .eq("tenant_id", profile.tenant_id)
    .single();
  if (!access) return { error: "No portal access found." };

  const userId = access.user_id as string | null;

  // Only clean up auth user + profile if the client has actually signed up
  if (userId) {
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
  }

  await admin
    .from("client_portal_access")
    .delete()
    .eq("client_id", clientId)
    .eq("tenant_id", profile.tenant_id);

  const { revalidatePath } = await import("next/cache");
  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}
