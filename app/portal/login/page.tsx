import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { PortalLoginForm } from "@/components/portal/PortalLoginForm";

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, requestHeaders] = await Promise.all([searchParams, headers()]);
  const tenantSlug = requestHeaders.get("x-tenant-slug") ?? "";

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .maybeSingle();

  if (!tenant) redirect("/");

  const { data: settings } = await admin
    .from("tenant_settings")
    .select("business_name")
    .eq("tenant_id", tenant.id)
    .single();

  const businessName = settings?.business_name ?? tenantSlug;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{businessName}</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your client portal
          </p>
        </div>
        <PortalLoginForm initialError={error} />
      </div>
    </div>
  );
}
