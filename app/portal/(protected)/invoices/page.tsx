import { headers } from "next/headers";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getImpersonationPayload } from "@/lib/portal/impersonation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

const STATUS_CONFIG = {
  sent: { label: "Sent", className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900" },
  viewed: { label: "Viewed", className: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-400 dark:border-sky-900" },
  paid: { label: "Paid", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900" },
  overdue: { label: "Overdue", className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900" },
} as const;

function invoiceDisplayStatus(invoice: { status: string; due_date: string | null }) {
  if (invoice.status === "paid") return "paid";
  if (
    invoice.due_date &&
    invoice.status !== "paid" &&
    new Date(invoice.due_date) < new Date()
  ) {
    return "overdue";
  }
  return invoice.status as "sent" | "viewed";
}

export default async function PortalInvoicesPage() {
  const tenantSlug = (await headers()).get("x-tenant-slug") ?? "";

  const [user, supabase, impersonation] = await Promise.all([
    getCachedUser(),
    createClient(),
    getImpersonationPayload(),
  ]);

  const admin = createAdminClient();
  const isImpersonating = !!impersonation && impersonation.tenantSlug === tenantSlug;

  let clientId: string | undefined;

  if (isImpersonating) {
    clientId = impersonation!.clientId;
  } else {
    const { data: access } = await supabase
      .from("client_portal_access")
      .select("client_id")
      .eq("user_id", user!.id)
      .single();
    clientId = access?.client_id;
  }

  const db = isImpersonating ? admin : supabase;

  const { data: invoices } = clientId
    ? await db
        .from("invoices")
        .select("id, invoice_number, status, issue_date, due_date, total, amount_paid")
        .eq("client_id", clientId)
        .order("issue_date", { ascending: false })
    : { data: [] };

  // Mark any "sent" invoices as "viewed" now that the client has opened this page
  if (!isImpersonating && invoices?.some((i) => i.status === "sent")) {
    const sentIds = invoices!.filter((i) => i.status === "sent").map((i) => i.id);
    await admin
      .from("invoices")
      .update({ status: "viewed", viewed_at: new Date().toISOString() })
      .in("id", sentIds);
    // Reflect update locally so the badges show "viewed"
    for (const inv of invoices!) {
      if (inv.status === "sent") inv.status = "viewed";
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Invoices</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Invoices your consultant has sent you.
        </p>
      </div>

      {!invoices?.length ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">No invoices yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-md border border-border">
          {invoices.map((invoice) => {
            const displayStatus = invoiceDisplayStatus(invoice);
            const config =
              STATUS_CONFIG[displayStatus] ??
              STATUS_CONFIG.sent;
            const outstanding =
              invoice.status !== "paid"
                ? Number(invoice.total) - Number(invoice.amount_paid ?? 0)
                : 0;

            return (
              <div
                key={invoice.id}
                className="flex items-center gap-4 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {invoice.invoice_number}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Issued {formatDate(invoice.issue_date)}
                    {invoice.due_date && ` · Due ${formatDate(invoice.due_date)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums">
                      {formatCurrency(Number(invoice.total))}
                    </p>
                    {outstanding > 0 && invoice.status !== "paid" && (
                      <p className={cn("text-xs tabular-nums", displayStatus === "overdue" ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                        {formatCurrency(outstanding)} due
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className={cn("text-xs", config.className)}>
                    {config.label}
                  </Badge>
                  <Link
                    href={`/api/pdf/portal/${invoice.id}`}
                    title="Download PDF"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
