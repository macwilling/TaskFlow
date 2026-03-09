"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { finalizePortalSessionAction } from "@/app/actions/portal";

/**
 * Handles the implicit-flow (hash-fragment) auth callback for admin-generated
 * portal invite links.
 *
 * @supabase/ssr forces flowType:'pkce' on the browser client, so it only looks
 * for ?code= and silently ignores #access_token= hash tokens.  The SIGNED_IN
 * event never fires through onAuthStateChange for these links.
 *
 * Instead we manually parse the hash, call setSession() to store the tokens in
 * the @supabase/ssr cookie adapter, then call a server action to finish account
 * setup (profile, portal_access, app_metadata).
 */
export function PortalAuthCallbackClient({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;

    const supabase = createClient();
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) {
      // No hash tokens — check for an existing session (returning user who
      // somehow landed here, or a stale/bad link).
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (handled.current) return;
        handled.current = true;
        if (session) {
          router.replace(`/portal/${tenantSlug}`);
        } else {
          router.replace(`/portal/${tenantSlug}/login?error=auth_callback_error`);
        }
      });
      return;
    }

    // Clear the hash from the URL so back-navigation doesn't re-trigger.
    window.history.replaceState(null, "", window.location.pathname);

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(async ({ data, error }) => {
        if (handled.current) return;
        handled.current = true;

        if (error || !data.session) {
          router.replace(`/portal/${tenantSlug}/login?error=auth_callback_error`);
          return;
        }

        // Cookies are now set — call the server action to finish setup.
        const result = await finalizePortalSessionAction(tenantSlug);
        if (result?.error === "not_invited") {
          router.replace(`/portal/${tenantSlug}/login?error=not_invited`);
        } else if (result?.error) {
          router.replace(`/portal/${tenantSlug}/login?error=auth_callback_error`);
        } else {
          router.replace(`/portal/${tenantSlug}`);
        }
      });
  }, [tenantSlug, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
}
