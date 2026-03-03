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

  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();

  // Fetch invoice data
  const { data: invoice, error: invError } = await adminClient
    .from("invoices")
    .select(`
      id, invoice_number, status, issue_date, due_date, memo,
      subtotal, discount_type, discount_value, tax_rate, tax_amount, total, amount_paid,
      clients(name, email, billing_address),
      invoice_line_items(description, quantity, unit_price, amount, sort_order)
    `)
    .eq("id", invoiceId)
    .single();

  if (invError || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Verify invoice belongs to admin's tenant
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const { data: invTenant } = await adminClient
    .from("invoices")
    .select("tenant_id")
    .eq("id", invoiceId)
    .single();

  if (!profile || !invTenant || profile.tenant_id !== invTenant.tenant_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch tenant settings
  const { data: settings } = await adminClient
    .from("tenant_settings")
    .select(
      "business_name, address_line1, address_line2, city, state, postal_code, email, phone, tax_label, payment_method_options"
    )
    .eq("tenant_id", profile.tenant_id)
    .single();

  const client = invoice.clients as unknown as {
    name: string;
    email: string | null;
    billing_address: Record<string, string> | null;
  } | null;

  const lineItems = (
    invoice.invoice_line_items as unknown as {
      description: string;
      quantity: number;
      unit_price: number;
      amount: number;
      sort_order: number;
    }[]
  );

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
      "Content-Disposition": `inline; filename="${invoice.invoice_number}.pdf"`,
    },
  });
}
