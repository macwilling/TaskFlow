import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { ArchiveClientButton } from "@/components/clients/ArchiveClientButton";
import { ClientQuickActions } from "@/components/clients/ClientQuickActions";
import { PortalAccessSection } from "@/components/portal/PortalAccessSection";
import { TaskStatusBadge, TaskPriorityBadge } from "@/components/tasks/TaskStatusBadge";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Pencil } from "lucide-react";

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-4 py-2 text-sm">
      <dt className="w-36 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

function effectiveInvoiceStatus(status: string, dueDate: string | null) {
  if (status === "paid") return "paid";
  if (dueDate && new Date(dueDate) < new Date() && status !== "draft") return "overdue";
  return status;
}


export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();

  const [
    { data: client, error },
    { data: portalAccess },
    { data: tasks },
    { data: timeEntries },
    { data: invoices },
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", clientId).single(),
    supabase
      .from("client_portal_access")
      .select("accepted_at")
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select("id, title, status, priority, due_date, task_number")
      .eq("client_id", clientId)
      .neq("status", "closed")
      .order("created_at", { ascending: false }),
    supabase
      .from("time_entries")
      .select("duration_hours, billable, billed, hourly_rate")
      .eq("client_id", clientId),
    supabase
      .from("invoices")
      .select("id, invoice_number, issue_date, due_date, total, status, amount_paid")
      .eq("client_id", clientId)
      .order("issue_date", { ascending: false }),
  ]);

  if (error || !client) notFound();

  const addr = client.billing_address as {
    line1?: string; line2?: string; city?: string;
    state?: string; postal_code?: string; country?: string;
  } | null;

  const billingAddress = [
    addr?.line1, addr?.line2,
    [addr?.city, addr?.state, addr?.postal_code].filter(Boolean).join(", "),
    addr?.country,
  ].filter(Boolean).join("\n");

  // Time summary
  type TimeEntry = { duration_hours: number | string; billable: boolean; billed: boolean; hourly_rate: number | string | null };
  const entries: TimeEntry[] = timeEntries ?? [];
  const totalHours = entries.reduce((s: number, e: TimeEntry) => s + Number(e.duration_hours), 0);
  const billableHours = entries.reduce((s: number, e: TimeEntry) => e.billable ? s + Number(e.duration_hours) : s, 0);
  const unbilledHours = entries.reduce((s: number, e: TimeEntry) => (e.billable && !e.billed) ? s + Number(e.duration_hours) : s, 0);
  const unbilledValue = entries.reduce((s: number, e: TimeEntry) =>
    (e.billable && !e.billed) ? s + Number(e.duration_hours) * Number(e.hourly_rate ?? 0) : s, 0
  );

  // Invoice outstanding balance
  type Invoice = { id: string; invoice_number: string; issue_date: string; due_date: string | null; total: number | string | null; status: string; amount_paid: number | string | null };
  const invoiceList: Invoice[] = invoices ?? [];
  const outstandingBalance = invoiceList
    .filter((inv: Invoice) => inv.status !== "paid" && inv.status !== "draft")
    .reduce((s: number, inv: Invoice) => s + (Number(inv.total ?? 0) - Number(inv.amount_paid ?? 0)), 0);

  // client_key for task links (all tasks share the same client)
  const clientKey = (client as unknown as { client_key: string | null }).client_key;

  // Tasks for the quick action modal (already fetched above, flatten client_key)
  const taskListForModal = (tasks ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    client_id: clientId,
  }));

  return (
    <>
      <TopBar
        title={client.name}
        description={client.company ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <ArchiveClientButton
              clientId={client.id}
              isArchived={client.is_archived}
            />
            <Button asChild size="sm" className="h-7 gap-1 text-xs">
              <Link href={`/clients/${client.id}/edit`}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Link>
            </Button>
          </div>
        }
      />

      <PageContainer>
        <div className="space-y-8 max-w-4xl">
          {/* Status */}
          {client.is_archived && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <Badge variant="secondary">Archived</Badge>
              <span>This client is archived and hidden from the main list.</span>
            </div>
          )}

          {/* Contact + billing side by side */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contact
              </h2>
              <Separator className="mb-3" />
              <dl>
                <InfoRow label="Email" value={client.email} />
                <InfoRow label="Phone" value={client.phone} />
                <InfoRow label="Company" value={client.company} />
              </dl>
            </div>

            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Billing
              </h2>
              <Separator className="mb-3" />
              <dl>
                <InfoRow
                  label="Hourly rate"
                  value={
                    client.default_rate != null
                      ? `${client.currency} ${Number(client.default_rate).toFixed(2)}/hr`
                      : undefined
                  }
                />
                <InfoRow
                  label="Payment terms"
                  value={client.payment_terms ? `Net ${client.payment_terms}` : undefined}
                />
                <InfoRow label="Currency" value={client.currency} />
                {billingAddress && (
                  <div className="flex gap-4 py-2 text-sm">
                    <dt className="w-36 shrink-0 text-muted-foreground">Billing address</dt>
                    <dd className="whitespace-pre-line text-foreground">{billingAddress}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Notes */}
          {client.notes && (
            <>
              <Separator />
              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Notes
                </h2>
                <p className="text-sm text-foreground whitespace-pre-line">{client.notes}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Quick actions */}
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Quick actions
            </h2>
            <ClientQuickActions
              clientId={client.id}
              clientName={client.name}
              clientDefaultRate={client.default_rate != null ? Number(client.default_rate) : null}
              tasks={taskListForModal}
            />
          </div>

          <Separator />

          {/* Active tasks */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Active tasks
              </h2>
              <Button asChild variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground">
                <Link href={`/tasks?clientId=${client.id}`}>View all</Link>
              </Button>
            </div>
            <Separator className="mb-3" />
            {(tasks ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No active tasks.</p>
            ) : (
              <div className="divide-y divide-border rounded-md border border-border">
                {(tasks ?? []).map((task) => {
                  const href = (clientKey && task.task_number != null)
                    ? `/tasks/${clientKey}-${task.task_number}`
                    : `/tasks/${task.id}`;
                  return (
                    <Link
                      key={task.id}
                      href={href}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-sm"
                    >
                      <span className="flex-1 font-medium text-foreground truncate">{task.title}</span>
                      {task.priority && <TaskPriorityBadge priority={task.priority} />}
                      {task.status && <TaskStatusBadge status={task.status} />}
                      <span className="text-xs text-muted-foreground w-24 text-right shrink-0">
                        {task.due_date ? formatDate(task.due_date) : "No due date"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <Separator />

          {/* Time summary */}
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Time summary
            </h2>
            <Separator className="mb-3" />
            <div className="grid grid-cols-4 gap-4">
              <StatCard label="Total hours" value={totalHours.toFixed(1)} />
              <StatCard label="Billable hours" value={billableHours.toFixed(1)} />
              <StatCard label="Unbilled hours" value={unbilledHours.toFixed(1)} />
              <StatCard
                label="Unbilled value"
                value={formatCurrency(unbilledValue, client.currency)}
              />
            </div>
          </div>

          <Separator />

          {/* Invoice history */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Invoice history
              </h2>
              {outstandingBalance > 0 && (
                <span className="text-xs text-muted-foreground">
                  Outstanding:{" "}
                  <span className="font-semibold text-foreground">
                    {formatCurrency(outstandingBalance, client.currency)}
                  </span>
                </span>
              )}
            </div>
            <Separator className="mb-3" />
            {invoiceList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              <div className="divide-y divide-border rounded-md border border-border">
                {invoiceList.map((inv) => {
                  const status = effectiveInvoiceStatus(inv.status, inv.due_date);
                  return (
                    <Link
                      key={inv.id}
                      href={`/invoices/${inv.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-sm"
                    >
                      <span className="font-medium text-foreground w-24 shrink-0">{inv.invoice_number}</span>
                      <span className="text-muted-foreground flex-1">{formatDate(inv.issue_date)}</span>
                      <InvoiceStatusBadge status={status} />
                      <span className="text-right font-medium text-foreground w-24 shrink-0">
                        {formatCurrency(Number(inv.total ?? 0), client.currency)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <Separator />

          {/* Client portal access */}
          <PortalAccessSection
            clientId={client.id}
            clientEmail={client.email}
            hasAccess={!!portalAccess}
            acceptedAt={portalAccess?.accepted_at ?? null}
          />
        </div>
      </PageContainer>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
