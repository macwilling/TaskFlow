"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ClientQuickActions, LogTimeButton } from "@/components/clients/ClientQuickActions";
import { ClientTasksTab } from "@/components/clients/ClientTasksTab";
import { ClientNotesEditor } from "@/components/clients/ClientNotesEditor";
import { PortalAccessSection } from "@/components/portal/PortalAccessSection";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ClientForTabs {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  default_rate: number | null;
  currency: string;
  payment_terms: number | null;
  color: string | null;
  is_archived: boolean;
}

export interface TaskForTabs {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  task_number: number | null;
}

export interface TimeEntryForTabs {
  id: string;
  date: string | null;
  description: string | null;
  duration_hours: number | string;
  billable: boolean;
  billed: boolean;
  hourly_rate: number | string | null;
  tasks: { title: string; task_number: number | null }[] | null;
}

export interface InvoiceForTabs {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  total: number | string | null;
  status: string;
  amount_paid: number | string | null;
}

export interface PortalAccessForTabs {
  accepted_at: string | null;
  invited_at: string | null;
  last_seen_at: string | null;
}

export type TabKey = "overview" | "tasks" | "time" | "invoices";

interface Props {
  client: ClientForTabs;
  clientKey: string | null;
  billingAddress: string;
  taskListForModal: { id: string; title: string; client_id: string; task_number: number | null; status: string }[];
  tasks: TaskForTabs[];
  entries: TimeEntryForTabs[];
  totalHours: number;
  billableHours: number;
  unbilledHours: number;
  unbilledValue: number;
  invoiceList: InvoiceForTabs[];
  outstandingBalance: number;
  portalAccess: PortalAccessForTabs | null;
  portalEmail: string | null;
  initialTab: TabKey;
  baseUrl: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <>
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {children}
      </h2>
      <Separator className="mb-4" />
    </>
  );
}

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

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "tasks", label: "Tasks" },
  { key: "time", label: "Time" },
  { key: "invoices", label: "Invoices" },
];

// ── Component ──────────────────────────────────────────────────────────────

export function ClientDetailTabs({
  client,
  clientKey,
  billingAddress,
  taskListForModal,
  tasks,
  entries,
  totalHours,
  billableHours,
  unbilledHours,
  unbilledValue,
  invoiceList,
  outstandingBalance,
  portalAccess,
  portalEmail,
  initialTab,
  baseUrl,
}: Props) {
  const [tab, setTab] = useState<TabKey>(initialTab);

  function switchTab(key: TabKey) {
    setTab(key);
    const url = key === "overview" ? baseUrl : `${baseUrl}?tab=${key}`;
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Archived banner */}
      {client.is_archived && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Badge variant="secondary">Archived</Badge>
          <span>This client is archived and hidden from the main list.</span>
        </div>
      )}

      {/* Tab nav */}
      <div className="flex gap-0 border-b border-border">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === "overview" && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <SectionHeader>Contact</SectionHeader>
              <dl>
                <InfoRow label="Email" value={client.email} />
                <InfoRow label="Phone" value={client.phone} />
                <InfoRow label="Company" value={client.company} />
              </dl>
            </div>
            <div>
              <SectionHeader>Billing</SectionHeader>
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

          <div>
            <SectionHeader>Notes</SectionHeader>
            <ClientNotesEditor clientId={client.id} initialNotes={client.notes} />
          </div>

          <ClientQuickActions
            clientId={client.id}
            clientName={client.name}
            clientKey={clientKey}
            clientDefaultRate={client.default_rate}
            tasks={taskListForModal}
          />

          <PortalAccessSection
            clientId={client.id}
            clientEmail={client.email}
            hasAccess={!!portalAccess}
            acceptedAt={portalAccess?.accepted_at ?? null}
            invitedAt={portalAccess?.invited_at ?? null}
            lastSeenAt={portalAccess?.last_seen_at ?? null}
            portalEmail={portalEmail}
          />
        </div>
      )}

      {/* ── Tasks ── */}
      {tab === "tasks" && (
        <ClientTasksTab tasks={tasks} clientId={client.id} clientKey={clientKey} />
      )}

      {/* ── Time ── */}
      {tab === "time" && (
        <div className="space-y-8">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Summary
              </h2>
              <LogTimeButton
                clientId={client.id}
                clientName={client.name}
                clientKey={clientKey}
                clientDefaultRate={client.default_rate}
                tasks={taskListForModal}
              />
            </div>
            <div className="flex divide-x divide-border rounded-md border border-border">
              {[
                { label: "Total hours", value: totalHours.toFixed(1) },
                { label: "Billable hours", value: billableHours.toFixed(1) },
                { label: "Unbilled hours", value: unbilledHours.toFixed(1) },
                { label: "Unbilled value", value: formatCurrency(unbilledValue, client.currency) },
              ].map(({ label, value }) => (
                <div key={label} className="flex-1 px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionHeader>All entries</SectionHeader>
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No time logged yet.</p>
            ) : (
              <div className="divide-y divide-border rounded-md border border-border">
                {entries.map((entry) => {
                  const task = Array.isArray(entry.tasks) ? entry.tasks[0] : null;
                  return (
                    <div key={entry.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                      <span className="text-muted-foreground w-24 shrink-0 tabular-nums">
                        {formatDate(entry.date)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-foreground truncate block">
                          {entry.description || (
                            <span className="italic text-muted-foreground">No description</span>
                          )}
                        </span>
                        {task && (
                          <span className="text-xs text-muted-foreground truncate block">
                            {task.title}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {entry.billable && (
                          <Badge
                            variant={entry.billed ? "secondary" : "outline"}
                            className="text-xs h-5 px-1.5"
                          >
                            {entry.billed ? "Billed" : "Billable"}
                          </Badge>
                        )}
                        <span className="font-medium tabular-nums text-foreground w-12 text-right">
                          {Number(entry.duration_hours).toFixed(1)}h
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Invoices ── */}
      {tab === "invoices" && (
        <div className="space-y-8">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Invoice history
              </h2>
              <div className="flex items-center gap-3">
                {outstandingBalance > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Outstanding:{" "}
                    <span className="font-semibold text-foreground">
                      {formatCurrency(outstandingBalance, client.currency)}
                    </span>
                  </span>
                )}
                <Button asChild size="sm" variant="outline" className="h-7 gap-1 text-xs">
                  <Link href={`/app/finance/invoices/new?clientId=${client.id}`}>New invoice</Link>
                </Button>
              </div>
            </div>
            <Separator className="mb-4" />
            {invoiceList.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No invoices yet.{" "}
                <Link
                  href={`/app/finance/invoices/new?clientId=${client.id}`}
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  Create an invoice →
                </Link>
              </p>
            ) : (
              <div className="divide-y divide-border rounded-md border border-border">
                {invoiceList.map((inv) => {
                  const status = effectiveInvoiceStatus(inv.status, inv.due_date);
                  const remaining = Number(inv.total ?? 0) - Number(inv.amount_paid ?? 0);
                  const isPartiallyPaid =
                    Number(inv.amount_paid ?? 0) > 0 && inv.status !== "paid";
                  return (
                    <Link
                      key={inv.id}
                      href={`/app/finance/invoices/${inv.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-sm"
                    >
                      <span className="font-medium text-foreground w-24 shrink-0">
                        {inv.invoice_number}
                      </span>
                      <span className="text-muted-foreground flex-1">
                        {formatDate(inv.issue_date)}
                      </span>
                      <InvoiceStatusBadge status={status} />
                      <span className="text-right w-24 shrink-0">
                        <span className="font-medium text-foreground block">
                          {formatCurrency(Number(inv.total ?? 0), client.currency)}
                        </span>
                        {isPartiallyPaid && (
                          <span className="text-xs text-muted-foreground">
                            Remaining: {formatCurrency(remaining, client.currency)}
                          </span>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
