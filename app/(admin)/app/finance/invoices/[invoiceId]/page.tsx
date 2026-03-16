import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { SendInvoiceButton } from "./SendInvoiceButton";
import { RecordPaymentClient } from "./RecordPaymentClient";
import { DeletePaymentButton } from "./DeletePaymentButton";
import { Edit, Download } from "lucide-react";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function effectiveStatus(status: string, dueDate: string | null): string {
  if (status === "paid") return "paid";
  if (dueDate && new Date(dueDate) < new Date() && status !== "draft") return "overdue";
  return status;
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const supabase = await createClient();

  const [{ data: invoice }, { data: settings }] = await Promise.all([
    supabase
      .from("invoices")
      .select(`
        id, invoice_number, status, issue_date, due_date, memo,
        subtotal, discount_type, discount_value, tax_rate, tax_amount, total, amount_paid,
        sent_at, viewed_at, created_at,
        clients(name, email, billing_address),
        invoice_line_items(id, description, quantity, unit_price, amount, sort_order),
        payments(id, amount, payment_date, payment_method, notes)
      `)
      .eq("id", invoiceId)
      .single(),
    supabase
      .from("tenant_settings")
      .select("tax_label, payment_method_options, business_name")
      .single(),
  ]);

  if (!invoice) notFound();

  const client = invoice.clients as unknown as {
    name: string;
    email: string | null;
    billing_address: Record<string, string> | null;
  } | null;

  const lineItems = (
    invoice.invoice_line_items as unknown as {
      id: string;
      description: string;
      quantity: number;
      unit_price: number;
      amount: number;
      sort_order: number;
    }[]
  ).sort((a, b) => a.sort_order - b.sort_order);

  const payments = (
    invoice.payments as unknown as {
      id: string;
      amount: number;
      payment_date: string;
      payment_method: string | null;
      notes: string | null;
    }[]
  ).sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime());

  const subtotal = Number(invoice.subtotal);
  const discountValue = Number(invoice.discount_value ?? 0);
  const discountAmount =
    invoice.discount_type === "flat"
      ? discountValue
      : invoice.discount_type === "percent"
      ? subtotal * (discountValue / 100)
      : 0;
  const taxAmount = Number(invoice.tax_amount);
  const total = Number(invoice.total);
  const amountPaid = Number(invoice.amount_paid);
  const balanceDue = total - amountPaid;
  const taxLabel = settings?.tax_label ?? "Tax";
  const taxRate = Number(invoice.tax_rate);
  const effectStatus = effectiveStatus(invoice.status, invoice.due_date);
  const paymentMethodOptions = settings?.payment_method_options ?? ["Check", "ACH", "Wire", "Credit Card", "Other"];

  const isDraft = invoice.status === "draft";
  const canSend = ["draft", "sent"].includes(invoice.status);
  const isPaid = invoice.status === "paid";

  return (
    <>
      <TopBar
        title={invoice.invoice_number}
        description={client?.name ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <InvoiceStatusBadge status={effectStatus} />
            {isDraft && (
              <Button asChild variant="outline" size="sm" className="h-7 gap-1 text-xs">
                <Link href={`/invoices/${invoiceId}/edit`}>
                  <Edit className="h-3.5 w-3.5" />
                  Edit
                </Link>
              </Button>
            )}
            {canSend && !isPaid && (
              <SendInvoiceButton invoiceId={invoiceId} />
            )}
            <Button asChild variant="outline" size="sm" className="h-7 gap-1 text-xs">
              <a href={`/api/pdf/${invoiceId}`} target="_blank" rel="noopener noreferrer">
                <Download className="h-3.5 w-3.5" />
                PDF
              </a>
            </Button>
          </div>
        }
      />
      <PageContainer>
        <div className="max-w-3xl space-y-8">
          {/* Meta panel */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Client</p>
              <p className="font-medium">{client?.name ?? "—"}</p>
              {client?.email && <p className="text-xs text-muted-foreground">{client.email}</p>}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Issued</p>
              <p>{formatDate(invoice.issue_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Due</p>
              <p className={effectStatus === "overdue" ? "text-red-600 dark:text-red-400 font-medium" : ""}>
                {formatDate(invoice.due_date)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Status</p>
              <InvoiceStatusBadge status={effectStatus} />
            </div>
          </div>

          <Separator />

          {/* Line items */}
          <div>
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Line Items</h2>
            <div className="rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Description</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground w-20">Qty</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground w-24">Rate</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground w-28">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lineItems.map((li) => (
                    <tr key={li.id}>
                      <td className="px-4 py-3">{li.description}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {Number(li.quantity).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {formatCurrency(Number(li.unit_price))}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {formatCurrency(Number(li.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5 text-sm">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    Discount{invoice.discount_type === "percent" ? ` (${discountValue}%)` : ""}
                  </span>
                  <span className="tabular-nums">-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              {taxAmount > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {taxLabel}{taxRate > 0 ? ` (${(taxRate * 100).toFixed(2)}%)` : ""}
                  </span>
                  <span className="tabular-nums">{formatCurrency(taxAmount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(total)}</span>
              </div>
              {amountPaid > 0 && (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="tabular-nums text-emerald-600 dark:text-emerald-400">-{formatCurrency(amountPaid)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Balance Due</span>
                    <span className="tabular-nums">{formatCurrency(balanceDue)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Memo */}
          {invoice.memo && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Notes</p>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{invoice.memo}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Payments */}
          <div>
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Payments</h2>
            {payments.length > 0 && (
              <div className="rounded-md border border-border mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Date</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Method</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Amount</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Notes</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {payments.map((p) => (
                      <tr key={p.id} className="group">
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(p.payment_date)}</td>
                        <td className="px-4 py-3">{p.payment_method ?? "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(Number(p.amount))}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{p.notes ?? "—"}</td>
                        <td className="pr-2">
                          <DeletePaymentButton paymentId={p.id} invoiceId={invoiceId} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!isPaid && (
              <RecordPaymentClient
                invoiceId={invoiceId}
                paymentMethodOptions={paymentMethodOptions}
              />
            )}
          </div>
        </div>
      </PageContainer>
    </>
  );
}
