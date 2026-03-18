import { redirect } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { BusinessInfoForm } from "@/components/settings/BusinessInfoForm";
import { TenantSlugForm } from "@/components/settings/TenantSlugForm";

export default async function GeneralSettingsPage() {
  const [user, supabase] = await Promise.all([getCachedUser(), createClient()]);
  if (!user || user.app_metadata?.role !== "admin") redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/auth/login");

  const tenantId = profile.tenant_id as string;

  const [{ data: settings }, { data: tenant }] = await Promise.all([
    supabase.from("tenant_settings").select("*").eq("tenant_id", tenantId).single(),
    createAdminClient().from("tenants").select("slug").eq("id", tenantId).single(),
  ]);

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Settings not found. Please contact support.</p>;
  }

  return (
    <>
      <TopBar title="General" />
      <PageContainer>
        <div className="space-y-10 max-w-3xl">
          <section>
            <h2 className="text-base font-semibold">Business information</h2>
            <p className="text-sm text-muted-foreground mt-0.5 mb-4">
              Used on invoices and as your business identity.
            </p>
            <BusinessInfoForm settings={settings} />
          </section>

          <Separator />

          <section>
            <h2 className="text-base font-semibold">Portal URL</h2>
            <p className="text-sm text-muted-foreground mt-0.5 mb-4">
              The URL your clients use to access their portal.
            </p>
            <TenantSlugForm slug={tenant?.slug ?? ""} />
          </section>
        </div>
      </PageContainer>
    </>
  );
}
