"use server";
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
      redirectTo: `${appUrl}/auth/callback?next=/portal/${tenant.slug}`,
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
