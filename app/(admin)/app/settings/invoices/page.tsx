import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { InvoiceSettingsForm } from "@/components/settings/InvoiceSettingsForm";

export default async function InvoiceSettingsPage() {
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
        <h2 className="text-base font-semibold">Invoice settings</h2>
        <p className="text-sm text-muted-foreground mt-0.5 mb-4">
          Defaults applied when creating new invoices.
        </p>
        <InvoiceSettingsForm settings={settings} />
      </section>
    </div>
  );
}
