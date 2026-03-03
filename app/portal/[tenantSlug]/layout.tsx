import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PortalSignOutButton } from "@/components/portal/PortalSignOutButton";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, slug")
    .eq("slug", tenantSlug)
    .single();

  if (!tenant) redirect("/auth/login?error=auth_callback_error");

  const { data: settings } = await admin
    .from("tenant_settings")
    .select("business_name")
    .eq("tenant_id", tenant.id)
    .single();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auth check: must be a client belonging to this tenant
  if (
    !user ||
    user.app_metadata?.role !== "client" ||
    user.app_metadata?.tenant_id !== tenant.id
  ) {
    redirect(`/portal/${tenantSlug}/login`);
  }

  const businessName = settings?.business_name ?? tenantSlug;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-6 h-12 flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">
            {businessName}
          </span>
          <PortalSignOutButton tenantSlug={tenantSlug} />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
