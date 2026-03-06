import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PortalSignOutButton } from "@/components/portal/PortalSignOutButton";
import { ImpersonationBanner } from "@/components/portal/ImpersonationBanner";
import { getImpersonationPayload } from "@/lib/portal/impersonation";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const admin = createAdminClient();
  // Tenant lookup, user fetch, and impersonation cookie can all resolve in parallel.
  const [{ data: tenant }, user, impersonation] = await Promise.all([
    admin.from("tenants").select("id, slug").eq("slug", tenantSlug).single(),
    getCachedUser(),
    getImpersonationPayload(),
  ]);

  if (!tenant) redirect("/auth/login?error=auth_callback_error");

  const { data: settings } = await admin
    .from("tenant_settings")
    .select("business_name")
    .eq("tenant_id", tenant.id)
    .single();

  // Impersonation mode: admin with a valid cookie scoped to this tenant
  const isImpersonating =
    !!impersonation &&
    impersonation.tenantSlug === tenantSlug &&
    !!user &&
    user.app_metadata?.role === "admin" &&
    user.app_metadata?.tenant_id === tenant.id;

  if (!isImpersonating) {
    // Normal auth check: must be a client belonging to this tenant
    if (
      !user ||
      user.app_metadata?.role !== "client" ||
      user.app_metadata?.tenant_id !== tenant.id
    ) {
      redirect(`/portal/${tenantSlug}/login`);
    }

    // Update last-seen timestamp for regular client sessions
    const supabase = await createClient();
    await supabase
      .from("client_portal_access")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("user_id", user!.id)
      .eq("tenant_id", tenant.id);
  }

  const businessName = settings?.business_name ?? tenantSlug;

  return (
    <div className="min-h-screen bg-background">
      {isImpersonating && (
        <ImpersonationBanner clientName={impersonation!.clientName} />
      )}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-6 h-12 flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">
            {businessName}
          </span>
          {!isImpersonating && <PortalSignOutButton tenantSlug={tenantSlug} />}
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
