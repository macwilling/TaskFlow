import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { InvoicePDF } from "@/components/invoices/InvoicePDF";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const { invoiceId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "client") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = user.app_metadata?.tenant_id as string | undefined;
  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve the portal client's client_id
  const { data: access } = await supabase
    .from("client_portal_access")
    .select("client_id")
    .eq("user_id", user.id)
    .single();

  if (!access?.client_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminClient = createAdminClient();

  // Fetch invoice and verify it belongs to this client
  const { data: invoice, error: invError } = await adminClient
    .from("invoices")
    .select(`
      id, invoice_number, status, issue_date, due_date, memo,
      subtotal, discount_type, discount_value, tax_rate, tax_amount, total, amount_paid,
      tenant_id, client_id,
      clients(name, email, billing_address),
      invoice_line_items(description, quantity, unit_price, amount, sort_order)
    `)
    .eq("id", invoiceId)
    .single();

  if (invError || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Ensure the invoice belongs to this client and tenant
  if (invoice.tenant_id !== tenantId || invoice.client_id !== access.client_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch tenant settings
  const { data: settings } = await adminClient
    .from("tenant_settings")
    .select(
      "business_name, address_line1, address_line2, city, state, postal_code, email, phone, tax_label, payment_method_options"
    )
    .eq("tenant_id", tenantId)
    .single();

  const client = invoice.clients as unknown as {
    name: string;
    email: string | null;
    billing_address: Record<string, string> | null;
  } | null;

  const lineItems = invoice.invoice_line_items as unknown as {
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
    sort_order: number;
  }[];

  const pdfProps = {
    invoice: {
      invoice_number: invoice.invoice_number,
      status: invoice.status,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      memo: invoice.memo,
      subtotal: Number(invoice.subtotal),
      discount_type: invoice.discount_type,
      discount_value: invoice.discount_value != null ? Number(invoice.discount_value) : null,
      tax_rate: Number(invoice.tax_rate),
      tax_amount: Number(invoice.tax_amount),
      total: Number(invoice.total),
      amount_paid: Number(invoice.amount_paid),
      clients: client,
      invoice_line_items: lineItems,
    },
    settings: {
      business_name: settings?.business_name ?? null,
      address_line1: settings?.address_line1 ?? null,
      address_line2: settings?.address_line2 ?? null,
      city: settings?.city ?? null,
      state: settings?.state ?? null,
      postal_code: settings?.postal_code ?? null,
      email: settings?.email ?? null,
      phone: settings?.phone ?? null,
      tax_label: settings?.tax_label ?? null,
      payment_method_options: settings?.payment_method_options ?? null,
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(createElement(InvoicePDF, pdfProps) as any);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoice_number}.pdf"`,
    },
  });
}
