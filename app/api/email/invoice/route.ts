import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { InvoicePDF } from "@/components/invoices/InvoicePDF";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  const { invoiceId } = await request.json();

  if (!invoiceId) {
    return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch invoice + client + tenant info
  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select(`
      id, invoice_number, status, issue_date, due_date, memo,
      subtotal, discount_type, discount_value, tax_rate, tax_amount, total, amount_paid,
      tenant_id,
      clients(name, email, billing_address),
      invoice_line_items(description, quantity, unit_price, amount, sort_order)
    `)
    .eq("id", invoiceId)
    .single();

  if (invError || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const client = invoice.clients as unknown as {
    name: string;
    email: string | null;
    billing_address: Record<string, string> | null;
  } | null;

  if (!client?.email) {
    return NextResponse.json({ skipped: true });
  }

  // Fetch tenant settings
  const { data: settings } = await supabase
    .from("tenant_settings")
    .select(
      "business_name, address_line1, address_line2, city, state, postal_code, email, phone, tax_label, payment_method_options, email_invoice_subject, email_invoice_body, email_sender_name, email_reply_to"
    )
    .eq("tenant_id", invoice.tenant_id)
    .single();

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
  const pdfBuffer = await renderToBuffer(createElement(InvoicePDF, pdfProps) as any);
  const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

  const businessName = settings?.business_name ?? "Your Consultant";
  const subject =
    settings?.email_invoice_subject ??
    `Invoice ${invoice.invoice_number} from ${businessName}`;

  const total = Number(invoice.total);
  const bodyHtml =
    settings?.email_invoice_body
      ? `<p>${escapeHtml(settings.email_invoice_body)}</p>`
      : `<p>Hi ${escapeHtml(client.name)},</p>
         <p>Please find your invoice ${escapeHtml(invoice.invoice_number)} for ${formatCurrency(total)} attached.</p>
         <p>Due: ${formatDate(invoice.due_date)}</p>
         <p>— ${escapeHtml(businessName)}</p>`;

  const fromEmail = `${settings?.email_sender_name ?? businessName} <noreply@${process.env.RESEND_DOMAIN ?? "taskflow.dev"}>`;

  const { data: sendData, error: sendError } = await resend.emails.send({
    from: fromEmail,
    to: client.email,
    replyTo: settings?.email_reply_to ?? undefined,
    subject,
    html: bodyHtml,
    attachments: [
      {
        filename: `${invoice.invoice_number}.pdf`,
        content: pdfBase64,
      },
    ],
  });

  // Log the email attempt
  await supabase.from("email_log").insert({
    tenant_id: invoice.tenant_id,
    to_email: client.email,
    subject,
    type: "invoice",
    related_id: invoiceId,
    resend_id: sendData?.id ?? null,
    status: sendError ? "failed" : "sent",
    error_message: sendError?.message ?? null,
  });

  if (sendError) {
    return NextResponse.json({ error: sendError.message }, { status: 500 });
  }

  return NextResponse.json({ sent: true });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(d: string | null) {
  if (!d) return "—";
  const [year, month, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}
