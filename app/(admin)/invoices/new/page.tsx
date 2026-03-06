import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { InvoiceBuilderClient } from "./InvoiceBuilderClient";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;
  const supabase = await createClient();

  const [{ data: clients }, { data: settings }] = await Promise.all([
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

  return (
    <>
      <TopBar title="New invoice" description="Build and send a new invoice." />
      <PageContainer>
        <InvoiceBuilderClient
          clients={clients ?? []}
          defaultTaxRate={Number(settings?.default_tax_rate ?? 0)}
          defaultPaymentTerms={settings?.default_payment_terms ?? 30}
          invoiceNumberPrefix={settings?.invoice_number_prefix ?? "INV-"}
          invoiceNumberNext={settings?.invoice_number_next ?? 1001}
          taxLabel={settings?.tax_label ?? "Tax"}
          paymentMethodOptions={settings?.payment_method_options ?? ["Check", "ACH", "Wire", "Credit Card", "Other"]}
          defaultClientId={clientId}
        />
      </PageContainer>
    </>
  );
}
