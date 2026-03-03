import { createAdminClient } from "@/lib/supabase/admin";
import { PortalLoginForm } from "@/components/portal/PortalLoginForm";

export default async function PortalLoginPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .single();

  let businessName = tenantSlug;
  if (tenant) {
    const { data: settings } = await admin
      .from("tenant_settings")
      .select("business_name")
      .eq("tenant_id", tenant.id)
      .single();
    if (settings?.business_name) businessName = settings.business_name;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{businessName}</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your client portal
          </p>
        </div>
        <PortalLoginForm tenantSlug={tenantSlug} />
      </div>
    </div>
  );
}
