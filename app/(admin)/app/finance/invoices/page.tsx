import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { InvoicesView } from "@/components/invoices/InvoicesView";
import { Plus } from "lucide-react";

export default async function InvoicesPage() {
  const supabase = await createClient();

  const [{ data: invoices, error }, { data: clients }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, status, issue_date, due_date, total, client_id, clients(name, color)")
      .order("created_at", { ascending: false }),
    supabase
      .from("clients")
      .select("id, name")
      .eq("is_archived", false)
      .order("name"),
  ]);

  return (
    <>
      <TopBar
        title="Invoices"
        actions={
          <Button asChild size="sm" className="h-7 gap-1 text-xs">
            <Link href="/app/finance/invoices/new">
              <Plus className="h-3.5 w-3.5" />
              New invoice
            </Link>
          </Button>
        }
      />
      <PageContainer>
        {error ? (
          <p className="text-sm text-destructive">Failed to load invoices: {error.message}</p>
        ) : (
          <Suspense fallback={null}>
            <InvoicesView
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              invoices={(invoices ?? []) as any}
              clients={clients ?? []}
            />
          </Suspense>
        )}
      </PageContainer>
    </>
  );
}
