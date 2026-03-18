import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { ArchiveClientButton } from "@/components/clients/ArchiveClientButton";
import { ClientDetailTabs, type TabKey, type TimeEntryForTabs } from "@/components/clients/ClientDetailTabs";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientKey: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { clientKey } = await params;
  const { tab: tabParam } = await searchParams;
  const initialTab: TabKey = (["overview", "tasks", "time", "invoices"] as string[]).includes(
    tabParam ?? ""
  )
    ? (tabParam as TabKey)
    : "overview";

  const supabase = await createClient();

  // First fetch client by key, then parallel-fetch related data
  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("client_key", clientKey)
    .single();

  if (error || !client) notFound();

  const clientId = client.id;

  const [
    { data: portalAccess },
    { data: tasks },
    { data: timeEntries },
    { data: invoices },
  ] = await Promise.all([
    supabase
      .from("client_portal_access")
      .select("accepted_at, invited_at, last_seen_at, user_id")
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select("id, title, status, priority, due_date, task_number")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("time_entries")
      .select("id, date, description, duration_hours, billable, billed, hourly_rate, tasks(title, task_number)")
      .eq("client_id", clientId)
      .order("date", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, invoice_number, issue_date, due_date, total, status, amount_paid")
      .eq("client_id", clientId)
      .order("issue_date", { ascending: false }),
  ]);

  let portalEmail: string | null = null;
  if (portalAccess?.user_id) {
    const admin = createAdminClient();
    const { data: authUser } = await admin.auth.admin.getUserById(portalAccess.user_id as string);
    portalEmail = authUser?.user?.email ?? null;
  }

  const addr = client.billing_address as {
    line1?: string; line2?: string; city?: string;
    state?: string; postal_code?: string; country?: string;
  } | null;

  const billingAddress = [
    addr?.line1, addr?.line2,
    [addr?.city, addr?.state, addr?.postal_code].filter(Boolean).join(", "),
    addr?.country,
  ].filter(Boolean).join("\n");

  const entries: TimeEntryForTabs[] = (timeEntries ?? []) as TimeEntryForTabs[];
  const totalHours = entries.reduce((s, e) => s + Number(e.duration_hours), 0);
  const billableHours = entries.reduce((s, e) => (e.billable ? s + Number(e.duration_hours) : s), 0);
  const unbilledHours = entries.reduce((s, e) => (e.billable && !e.billed ? s + Number(e.duration_hours) : s), 0);
  const unbilledValue = entries.reduce(
    (s, e) => (e.billable && !e.billed ? s + Number(e.duration_hours) * Number(e.hourly_rate ?? 0) : s),
    0
  );

  const invoiceList = invoices ?? [];
  const outstandingBalance = invoiceList
    .filter((inv) => inv.status !== "paid" && inv.status !== "draft")
    .reduce((s, inv) => s + (Number(inv.total ?? 0) - Number(inv.amount_paid ?? 0)), 0);

  const taskListForModal = (tasks ?? [])
    .filter((t) => t.status !== "closed")
    .map((t) => ({
      id: t.id,
      title: t.title,
      client_id: clientId,
      task_number: t.task_number,
      status: t.status,
    }));

  return (
    <>
      <TopBar
        title={client.name}
        description={client.company ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <ArchiveClientButton clientId={client.id} isArchived={client.is_archived} />
            <Button asChild size="sm" className="h-7 gap-1 text-xs">
              <Link href={`/app/clients/${clientKey}/edit`}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Link>
            </Button>
          </div>
        }
      />
      <PageContainer>
        <ClientDetailTabs
          client={{
            id: client.id,
            name: client.name,
            company: client.company,
            email: client.email,
            phone: client.phone,
            notes: client.notes,
            default_rate: client.default_rate != null ? Number(client.default_rate) : null,
            currency: client.currency,
            payment_terms: client.payment_terms,
            color: client.color,
            is_archived: client.is_archived,
          }}
          clientKey={clientKey}
          billingAddress={billingAddress}
          taskListForModal={taskListForModal}
          tasks={tasks ?? []}
          entries={entries}
          totalHours={totalHours}
          billableHours={billableHours}
          unbilledHours={unbilledHours}
          unbilledValue={unbilledValue}
          invoiceList={invoiceList}
          outstandingBalance={outstandingBalance}
          portalAccess={
            portalAccess
              ? {
                  accepted_at: portalAccess.accepted_at ?? null,
                  invited_at: (portalAccess as { invited_at?: string | null }).invited_at ?? null,
                  last_seen_at: (portalAccess as { last_seen_at?: string | null }).last_seen_at ?? null,
                }
              : null
          }
          portalEmail={portalEmail}
          initialTab={initialTab}
          baseUrl={`/app/clients/${clientKey}`}
        />
      </PageContainer>
    </>
  );
}
