import { NextRequest, NextResponse } from "next/server";
import { getCachedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getImpersonationPayload, IMPERSONATION_COOKIE } from "@/lib/portal/impersonation";

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);

  const [user, impersonation] = await Promise.all([
    getCachedUser(),
    getImpersonationPayload(),
  ]);

  if (user && impersonation) {
    // Audit log — impersonation ended
    const admin = createAdminClient();
    await admin.from("email_log").insert({
      tenant_id: impersonation.tenantId,
      to_email: user.email ?? "",
      subject: `[Audit] Portal impersonation ended: ${impersonation.clientName}`,
      type: "impersonation_end",
      related_id: impersonation.clientId,
      status: "sent",
      sent_at: new Date().toISOString(),
    });
  }

  const redirectTo = impersonation
    ? `${origin}/clients/${impersonation.clientId}`
    : `${origin}/dashboard`;

  const response = NextResponse.redirect(redirectTo);

  // Clear the cookie by setting maxAge=0 with same path
  if (impersonation) {
    response.cookies.set(IMPERSONATION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: `/portal/${impersonation.tenantSlug}`,
      maxAge: 0,
    });
  } else {
    // Fallback: clear without a specific path
    response.cookies.delete(IMPERSONATION_COOKIE);
  }

  return response;
}
