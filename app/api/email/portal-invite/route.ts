import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(request: NextRequest) {
  const caller = await createClient();
  const {
    data: { user },
  } = await caller.auth.getUser();
  if (!user || user.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await request.json();
  if (!clientId) {
    return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Get admin's tenant
  const { data: adminProfile } = await admin
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!adminProfile) {
    return NextResponse.json({ error: "Admin profile not found" }, { status: 404 });
  }

  // Fetch client + tenant info
  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("email, name, tenant_id")
    .eq("id", clientId)
    .eq("tenant_id", adminProfile.tenant_id)
    .single();

  if (clientError || !client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  if (!client.email) {
    return NextResponse.json({ skipped: true });
  }

  const { data: tenant } = await admin
    .from("tenants")
    .select("slug")
    .eq("id", client.tenant_id)
    .single();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const { data: settings } = await admin
    .from("tenant_settings")
    .select("business_name")
    .eq("tenant_id", client.tenant_id)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businessName = ((settings as any)?.business_name as string | null) ?? "Your consultant";

  // Generate magic link
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
    return NextResponse.json(
      { error: (linkError as Error | null)?.message ?? "Failed to generate sign-in link" },
      { status: 500 }
    );
  }

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
    tenant_id: client.tenant_id,
    to_email: client.email,
    subject,
    type: "portal_invite",
    related_id: clientId,
    resend_id: sendData?.id ?? null,
    status: sendError ? "failed" : "sent",
    error_message: (sendError as Error | null)?.message ?? null,
  });

  if (sendError) {
    return NextResponse.json({ error: (sendError as Error).message }, { status: 500 });
  }

  return NextResponse.json({ sent: true });
}
