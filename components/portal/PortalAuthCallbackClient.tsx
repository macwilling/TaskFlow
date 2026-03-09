"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { finalizePortalSessionAction } from "@/app/actions/portal";

/**
 * Handles the implicit-flow (hash-fragment) auth callback for admin-generated
 * portal invite links.
 *
 * Admin magic links created via admin.auth.admin.generateLink() use the OTP
 * (implicit) flow: Supabase redirects back with #access_token=… in the URL
 * hash rather than a ?code= query param.  Hash fragments are never sent to the
 * server, so a server-side route handler can't process them.  This client
 * component runs in the browser, lets @supabase/ssr detect the hash and set
 * the session cookie, then calls a server action to finish account setup.
 */
export function PortalAuthCallbackClient({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (handled.current) return;

      if (event === "SIGNED_IN" && session) {
        handled.current = true;
        const result = await finalizePortalSessionAction(tenantSlug);
        if (result?.error === "not_invited") {
          router.replace(`/portal/${tenantSlug}/login?error=not_invited`);
        } else if (result?.error) {
          router.replace(`/portal/${tenantSlug}/login?error=auth_callback_error`);
        } else {
          router.replace(`/portal/${tenantSlug}`);
        }
      } else if (event === "INITIAL_SESSION") {
        if (session) {
          // Returning user who somehow landed on this page while already signed in
          handled.current = true;
          router.replace(`/portal/${tenantSlug}`);
        } else if (!window.location.hash.includes("access_token")) {
          // No hash tokens and no session — nothing will arrive; bail out
          handled.current = true;
          router.replace(`/portal/${tenantSlug}/login?error=auth_callback_error`);
        }
        // If there ARE hash tokens, stay and wait for SIGNED_IN
      }
    });

    return () => subscription.unsubscribe();
  }, [tenantSlug, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
}
