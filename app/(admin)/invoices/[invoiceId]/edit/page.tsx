import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { InvoiceBuilderClient } from "../../new/InvoiceBuilderClient";
import { updateInvoiceAction } from "@/app/actions/invoices";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const supabase = await createClient();

  const [{ data: invoice }, { data: clients }, { data: settings }] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id, status, invoice_number, client_id, issue_date, due_date, memo, discount_type, discount_value, tax_rate, invoice_line_items(id, description, quantity, unit_price, amount, sort_order, time_entry_id)"
      )
      .eq("id", invoiceId)
      .single(),
    supabase
      .from("clients")
      .select("id, name, color, default_rate")
      .eq("is_archived", false)
      .order("name"),
    supabase
      .from("tenant_settings")
      .select(
        "default_tax_rate, invoice_number_prefix, invoice_number_next, default_payment_terms, tax_label, payment_method_options"
      )
      .single(),
  ]);

  if (!invoice) notFound();

  // Guard: only draft invoices can be edited
  if (invoice.status !== "draft") {
    redirect(`/invoices/${invoiceId}`);
  }

  let keyCounter = 0;
  const lineItems = (
    invoice.invoice_line_items as unknown as {
      id: string;
      description: string;
      quantity: number;
      unit_price: number;
      amount: number;
      sort_order: number;
      time_entry_id: string | null;
    }[]
  )
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((li) => ({
      key: `existing-${++keyCounter}`,
      description: li.description,
      quantity: Number(li.quantity),
      unit_price: Number(li.unit_price),
      amount: Number(li.amount),
      sort_order: li.sort_order,
      time_entry_id: li.time_entry_id,
      imported: li.time_entry_id !== null,
    }));

  const boundAction = updateInvoiceAction.bind(null, invoiceId);

  return (
    <>
      <TopBar
        title={`Edit ${invoice.invoice_number}`}
        description="Modify this draft invoice."
      />
      <PageContainer>
        <InvoiceBuilderClient
          clients={clients ?? []}
          defaultTaxRate={Number(settings?.default_tax_rate ?? 0)}
          defaultPaymentTerms={settings?.default_payment_terms ?? 30}
          invoiceNumberPrefix={settings?.invoice_number_prefix ?? "INV-"}
          invoiceNumberNext={settings?.invoice_number_next ?? 1001}
          taxLabel={settings?.tax_label ?? "Tax"}
          paymentMethodOptions={settings?.payment_method_options ?? ["Check", "ACH", "Wire", "Credit Card", "Other"]}
          initialData={{
            clientId: invoice.client_id,
            issueDate: invoice.issue_date,
            dueDate: invoice.due_date ?? "",
            memo: invoice.memo ?? "",
            discountType: (invoice.discount_type as "flat" | "percent" | "") ?? "",
            discountValue: Number(invoice.discount_value ?? 0),
            taxRate: Number(invoice.tax_rate),
            lineItems,
          }}
          formAction={boundAction}
        />
      </PageContainer>
    </>
  );
}
