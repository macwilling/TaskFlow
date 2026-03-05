import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  total: number;
  clients: { name: string; color: string | null } | null;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function effectiveStatus(invoice: Invoice): string {
  if (invoice.status === "paid") return "paid";
  if (invoice.due_date && new Date(invoice.due_date) < new Date() && invoice.status !== "draft") {
    return "overdue";
  }
  return invoice.status;
}

export function InvoiceListView({ invoices }: { invoices: Invoice[] }) {
  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-16 text-center">
        <p className="text-sm font-medium">No invoices yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Create your first invoice to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">#</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Client</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Issued</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Due</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Total</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {invoices.map((inv) => {
            const status = effectiveStatus(inv);
            const isOverdue = status === "overdue";
            return (
              <tr key={inv.id} className="group hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="font-mono text-xs font-medium text-foreground hover:underline"
                  >
                    {inv.invoice_number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {inv.clients ? (
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: inv.clients.color ?? "#0969da" }}
                      />
                      {inv.clients.name}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.issue_date)}</td>
                <td className={`px-4 py-3 ${isOverdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"}`}>
                  {formatDate(inv.due_date)}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">
                  {formatCurrency(Number(inv.total))}
                </td>
                <td className="px-4 py-3">
                  <InvoiceStatusBadge status={status} />
                </td>
                <td className="pr-3">
                  <Link href={`/invoices/${inv.id}`}>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
