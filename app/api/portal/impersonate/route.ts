import { NextRequest, NextResponse } from "next/server";
import { getCachedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  makePayload,
  encodePayload,
  IMPERSONATION_COOKIE,
} from "@/lib/portal/impersonation";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const clientId = searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  // Verify admin session
  const user = await getCachedUser();
  if (!user || user.app_metadata?.role !== "admin") {
    return NextResponse.redirect(`${origin}/auth/login`);
  }

  const adminTenantId = user.app_metadata?.tenant_id as string | undefined;
  if (!adminTenantId) {
    return NextResponse.redirect(`${origin}/dashboard?error=no_tenant`);
  }

  const admin = createAdminClient();

  // Fetch portal access for this client (scoped to admin's tenant)
  const { data: access } = await admin
    .from("client_portal_access")
    .select("user_id, clients(name)")
    .eq("client_id", clientId)
    .eq("tenant_id", adminTenantId)
    .single();

  if (!access) {
    return NextResponse.redirect(`${origin}/clients/${clientId}?error=no_portal_access`);
  }

  const { data: tenant } = await admin
    .from("tenants")
    .select("slug")
    .eq("id", adminTenantId)
    .single();

  if (!tenant) {
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientName = (access.clients as any)?.name ?? "Client";

  const payload = makePayload({
    clientId,
    userId: access.user_id as string,
    tenantId: adminTenantId,
    tenantSlug: tenant.slug,
    clientName,
    adminUserId: user.id,
  });

  // Log impersonation start to email_log for audit trail
  await admin.from("email_log").insert({
    tenant_id: adminTenantId,
    to_email: user.email ?? "",
    subject: `[Audit] Portal impersonation started: ${clientName}`,
    type: "impersonation_start",
    related_id: clientId,
    status: "sent",
    sent_at: new Date().toISOString(),
  });

  const response = NextResponse.redirect(`${origin}/portal/${tenant.slug}`);
  response.cookies.set(IMPERSONATION_COOKIE, encodePayload(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/portal/${tenant.slug}`,
    maxAge: 30 * 60, // 30 minutes in seconds
  });

  return response;
}
