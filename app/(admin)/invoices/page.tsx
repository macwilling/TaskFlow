import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { InvoiceListView } from "@/components/invoices/InvoiceListView";
import { InvoiceFilters } from "@/components/invoices/InvoiceFilters";
import { Plus } from "lucide-react";

interface SearchParams {
  status?: string;
  client?: string;
}

function effectiveStatus(status: string, dueDate: string | null): string {
  if (status === "paid") return "paid";
  if (dueDate && new Date(dueDate) < new Date() && status !== "draft") return "overdue";
  return status;
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { status, client } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("invoices")
    .select("id, invoice_number, status, issue_date, due_date, total, clients(name, color)")
    .order("created_at", { ascending: false });

  if (client) query = query.eq("client_id", client);

  const { data: invoices, error } = await query;

  // Apply effective status filter client-side (overdue is computed, not stored)
  const filtered = (invoices ?? []).filter((inv) => {
    if (!status) return true;
    const es = effectiveStatus(inv.status, inv.due_date);
    return es === status;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedInvoices = filtered as any[];

  return (
    <>
      <TopBar
        title="Invoices"
        actions={
          <Button asChild size="sm" className="h-7 gap-1 text-xs">
            <Link href="/invoices/new">
              <Plus className="h-3.5 w-3.5" />
              New invoice
            </Link>
          </Button>
        }
      />
      <PageContainer>
        <div className="space-y-4">
          <Suspense fallback={null}>
            <InvoiceFilters />
          </Suspense>

          {error ? (
            <p className="text-sm text-destructive">Failed to load invoices: {error.message}</p>
          ) : (
            <InvoiceListView invoices={typedInvoices} />
          )}
        </div>
      </PageContainer>
    </>
  );
}
