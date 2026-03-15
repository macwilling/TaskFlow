import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { BrandingForm } from "@/components/settings/BrandingForm";

export default async function BrandingSettingsPage() {
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
    <div className="max-w-3xl">
      <section>
        <h2 className="text-base font-semibold">Branding</h2>
        <p className="text-sm text-muted-foreground mt-0.5 mb-4">
          Logo and colors shown in the client portal.
        </p>
        <BrandingForm tenantId={tenantId} settings={settings} />
      </section>
    </div>
  );
}
