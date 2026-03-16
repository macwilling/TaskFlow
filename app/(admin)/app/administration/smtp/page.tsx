import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function SmtpSettingsPage() {
  const [user, supabase] = await Promise.all([getCachedUser(), createClient()]);
  if (!user || user.app_metadata?.role !== "admin") redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/auth/login");

  const { data: settings } = await supabase
    .from("tenant_settings")
    .select("smtp_host, smtp_port, smtp_username, smtp_from_email, smtp_from_name")
    .eq("tenant_id", profile.tenant_id as string)
    .single();

  return (
    <>
      <TopBar title="Custom SMTP" description="Use your own mail server for outgoing emails" />
      <PageContainer>
        <div className="max-w-lg space-y-6">
          <p className="text-sm text-muted-foreground">
            When configured, all notification emails (task closed, invoices, comments) will be sent
            through your SMTP server instead of the shared Resend relay.
          </p>

          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="smtp_host">SMTP host</Label>
              <Input id="smtp_host" defaultValue={settings?.smtp_host ?? ""} placeholder="smtp.example.com" disabled />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="smtp_port">Port</Label>
              <Input id="smtp_port" defaultValue={settings?.smtp_port ?? ""} placeholder="587" disabled />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="smtp_username">Username</Label>
              <Input id="smtp_username" defaultValue={settings?.smtp_username ?? ""} placeholder="you@example.com" disabled />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="smtp_from_email">From email</Label>
              <Input id="smtp_from_email" defaultValue={settings?.smtp_from_email ?? ""} placeholder="hello@yourbiz.com" disabled />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="smtp_from_name">From name</Label>
              <Input id="smtp_from_name" defaultValue={settings?.smtp_from_name ?? ""} placeholder="Your Business" disabled />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Save action coming soon — tracked in issue #102.
          </p>
        </div>
      </PageContainer>
    </>
  );
}
