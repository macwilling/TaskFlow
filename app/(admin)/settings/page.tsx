import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { Separator } from "@/components/ui/separator";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BusinessInfoForm } from "@/components/settings/BusinessInfoForm";
import { BrandingForm } from "@/components/settings/BrandingForm";
import { InvoiceSettingsForm } from "@/components/settings/InvoiceSettingsForm";
import { EmailTemplatesForm } from "@/components/settings/EmailTemplatesForm";
import { TenantSlugForm } from "@/components/settings/TenantSlugForm";

export default async function SettingsPage() {
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
    supabase
      .from("tenant_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .single(),
    createAdminClient().from("tenants").select("slug").eq("id", tenantId).single(),
  ]);

  if (!settings) {
    return (
      <>
        <TopBar title="Settings" />
        <PageContainer>
          <p className="text-sm text-muted-foreground">Settings not found. Please contact support.</p>
        </PageContainer>
      </>
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <>
      <TopBar title="Settings" description="Manage your account and workspace preferences." />
      <PageContainer>
        <div className="space-y-10 max-w-3xl">

          {/* Business info */}
          <section>
            <h2 className="text-base font-semibold">Business information</h2>
            <p className="text-sm text-muted-foreground mt-0.5 mb-4">
              Used on invoices and as your business identity.
            </p>
            <BusinessInfoForm settings={settings} />
          </section>

          <Separator />

          {/* Branding */}
          <section>
            <h2 className="text-base font-semibold">Branding</h2>
            <p className="text-sm text-muted-foreground mt-0.5 mb-4">
              Logo and colors shown in the client portal.
            </p>
            <BrandingForm tenantId={tenantId} settings={settings} />
          </section>

          <Separator />

          {/* Invoice settings */}
          <section>
            <h2 className="text-base font-semibold">Invoice settings</h2>
            <p className="text-sm text-muted-foreground mt-0.5 mb-4">
              Defaults applied when creating new invoices.
            </p>
            <InvoiceSettingsForm settings={settings} />
          </section>

          <Separator />

          {/* Email templates */}
          <section>
            <h2 className="text-base font-semibold">Email templates</h2>
            <p className="text-sm text-muted-foreground mt-0.5 mb-4">
              Customize outgoing notification emails.
            </p>
            <EmailTemplatesForm settings={settings} />
          </section>

          <Separator />

          {/* Tenant slug */}
          <section>
            <h2 className="text-base font-semibold">Portal URL</h2>
            <p className="text-sm text-muted-foreground mt-0.5 mb-4">
              The URL your clients use to access their portal.
            </p>
            <TenantSlugForm slug={tenant?.slug ?? ""} appUrl={appUrl} />
          </section>

        </div>
      </PageContainer>
    </>
  );
}
