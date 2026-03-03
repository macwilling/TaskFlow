"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function PortalSignOutButton({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/portal/${tenantSlug}/login`);
    router.refresh();
  }
  return (
    <Button variant="ghost" size="sm" className="text-xs" onClick={handleSignOut}>
      Sign out
    </Button>
  );
}
