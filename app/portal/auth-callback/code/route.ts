import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Portal PKCE callback handler for Google OAuth.
 *
 * When a portal client signs in with Google, Supabase redirects back with a
 * ?code= parameter (PKCE flow). This route exchanges the code for a session
 * and then redirects to the portal auth-callback page, which calls
 * finalizePortalSessionAction to complete account setup.
 *
 * OTP magic links use hash-fragment tokens (#access_token=...) which are
 * handled entirely client-side in PortalAuthCallbackClient — they do not
 * go through this route.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/portal/login?error=auth_callback_error`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/portal/login?error=auth_callback_error`);
  }

  // Session is now set in cookies. Redirect to the auth-callback page which
  // calls finalizePortalSessionAction to create/update the portal profile.
  return NextResponse.redirect(`${origin}/portal/auth-callback`);
}
