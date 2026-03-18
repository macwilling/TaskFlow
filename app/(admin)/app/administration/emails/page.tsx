import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmailTemplatesForm } from "@/components/settings/EmailTemplatesForm";

export default async function EmailSettingsPage() {
  const [user, supabase] = await Promise.all([getCachedUser(), createClient()]);
  if (!user || user.app_metadata?.role !== "admin") redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/auth/login");

  const tenantId = profile.tenant_id as string;

  const { data: settings } = await supabase
    .from("tenant_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .single();

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Settings not found. Please contact support.</p>;
  }

  return (
    <>
      <TopBar title="Emails" />
      <PageContainer>
        <div className="max-w-3xl">
          <section>
            <h2 className="text-base font-semibold">Email templates</h2>
            <p className="text-sm text-muted-foreground mt-0.5 mb-4">
              Customize outgoing notification emails.
            </p>
            <EmailTemplatesForm settings={settings} />
          </section>
        </div>
      </PageContainer>
    </>
  );
}
