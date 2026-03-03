"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { finalizeInviteAction } from "@/app/actions/portal";

export default function AcceptInvitePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handle() {
      const supabase = createClient();

      // Supabase JS client automatically processes the #access_token hash
      // and stores the session in cookies before getSession() resolves.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Authentication failed. Please try the invite link again.");
        return;
      }

      const result = await finalizeInviteAction();

      if (result.error) {
        setError(result.error);
        return;
      }

      // Refresh session so the updated app_metadata (role + tenant_slug)
      // is reflected in the JWT before the portal redirect hits proxy.ts.
      await supabase.auth.refreshSession();

      if (result.slug) {
        router.replace(`/portal/${result.slug}`);
      }
    }

    handle();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-2 px-4 text-center">
        {error ? (
          <>
            <p className="text-sm font-medium text-destructive">{error}</p>
            <a
              href="/auth/login"
              className="text-xs text-muted-foreground hover:underline"
            >
              Back to login
            </a>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Setting up your account…
          </p>
        )}
      </div>
    </div>
  );
}
