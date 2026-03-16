import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export default async function PaymentsPage() {
  const supabase = await createClient();

  const { data: payments, error } = await supabase
    .from("payments")
    .select(
      "id, amount, payment_date, payment_method, notes, invoice_id, invoices(invoice_number, client_id, clients(name, color))"
    )
    .order("payment_date", { ascending: false });

  return (
    <>
      <TopBar title="Payments" description="All payments received across invoices" />
      <PageContainer>
        {error ? (
          <p className="text-sm text-destructive">Failed to load payments: {error.message}</p>
        ) : !payments || payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-16 text-center">
            <p className="text-sm font-medium">No payments recorded yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Record a payment from an invoice&apos;s detail page.
            </p>
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Client</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Invoice</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Method</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((p) => {
                  const invoice = p.invoices as unknown as {
                    invoice_number: string;
                    client_id: string;
                    clients: { name: string; color: string } | null;
                  } | null;
                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {formatDate(p.payment_date)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: invoice?.clients?.color ?? "#0969da" }}
                          />
                          <span className="text-foreground">{invoice?.clients?.name ?? "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {invoice ? (
                          <Link
                            href={`/app/finance/invoices/${p.invoice_id}`}
                            className="text-primary hover:underline tabular-nums"
                          >
                            {invoice.invoice_number}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.payment_method ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {formatCurrency(p.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PageContainer>
    </>
  );
}
