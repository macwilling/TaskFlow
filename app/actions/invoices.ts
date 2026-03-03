"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LineItemInput {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
  time_entry_id?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseLineItems(formData: FormData): LineItemInput[] {
  const raw = formData.get("line_items") as string | null;
  if (!raw) return [];
  try {
    return JSON.parse(raw) as LineItemInput[];
  } catch {
    return [];
  }
}

function computeTotals(
  items: LineItemInput[],
  discountType: string | null,
  discountValue: number,
  taxRate: number
) {
  const subtotal = items.reduce((sum, i) => sum + i.amount, 0);
  let discountAmount = 0;
  if (discountType === "flat") discountAmount = discountValue;
  else if (discountType === "percent") discountAmount = subtotal * (discountValue / 100);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * taxRate;
  const total = taxableAmount + taxAmount;
  return { subtotal, taxAmount, total };
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createInvoiceAction(
  _prev: { error?: string; id?: string } | null,
  formData: FormData
): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return { error: "Unauthorized." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "Profile not found." };

  const client_id = formData.get("client_id") as string;
  const issue_date = formData.get("issue_date") as string;
  const due_date = (formData.get("due_date") as string) || null;
  const memo = (formData.get("memo") as string) || null;
  const discount_type = (formData.get("discount_type") as string) || null;
  const discount_value = parseFloat((formData.get("discount_value") as string) || "0") || 0;
  const tax_rate = parseFloat((formData.get("tax_rate") as string) || "0") || 0;

  if (!client_id) return { error: "Client is required." };
  if (!issue_date) return { error: "Issue date is required." };

  const lineItems = parseLineItems(formData);
  if (lineItems.length === 0) return { error: "At least one line item is required." };

  const { subtotal, taxAmount, total } = computeTotals(
    lineItems,
    discount_type,
    discount_value,
    tax_rate
  );

  // Atomically claim invoice number via admin client (bypasses RLS on tenant_settings)
  const adminClient = createAdminClient();
  const { data: invoiceNumber, error: numError } = await adminClient.rpc(
    "claim_invoice_number",
    { p_tenant_id: profile.tenant_id }
  );
  if (numError) return { error: numError.message };

  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .insert({
      tenant_id: profile.tenant_id,
      client_id,
      invoice_number: invoiceNumber as string,
      issue_date,
      due_date,
      memo,
      subtotal,
      discount_type: discount_type || null,
      discount_value: discount_value || null,
      tax_rate,
      tax_amount: taxAmount,
      total,
    })
    .select("id")
    .single();

  if (invError || !invoice) return { error: invError?.message ?? "Failed to create invoice." };

  const { error: itemsError } = await supabase.from("invoice_line_items").insert(
    lineItems.map((item, i) => ({
      tenant_id: profile.tenant_id,
      invoice_id: invoice.id,
      time_entry_id: item.time_entry_id || null,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
      sort_order: item.sort_order ?? i,
    }))
  );

  if (itemsError) return { error: itemsError.message };

  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

// ─── Update (draft only) ──────────────────────────────────────────────────────

export async function updateInvoiceAction(
  invoiceId: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return { error: "Unauthorized." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "Profile not found." };

  // Guard: only draft invoices can be edited
  const { data: existing } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .single();

  if (!existing) return { error: "Invoice not found." };
  if (existing.status !== "draft") return { error: "Only draft invoices can be edited." };

  const client_id = formData.get("client_id") as string;
  const issue_date = formData.get("issue_date") as string;
  const due_date = (formData.get("due_date") as string) || null;
  const memo = (formData.get("memo") as string) || null;
  const discount_type = (formData.get("discount_type") as string) || null;
  const discount_value = parseFloat((formData.get("discount_value") as string) || "0") || 0;
  const tax_rate = parseFloat((formData.get("tax_rate") as string) || "0") || 0;

  const lineItems = parseLineItems(formData);
  if (lineItems.length === 0) return { error: "At least one line item is required." };

  const { subtotal, taxAmount, total } = computeTotals(
    lineItems,
    discount_type,
    discount_value,
    tax_rate
  );

  const { error: invError } = await supabase
    .from("invoices")
    .update({
      client_id,
      issue_date,
      due_date,
      memo,
      subtotal,
      discount_type: discount_type || null,
      discount_value: discount_value || null,
      tax_rate,
      tax_amount: taxAmount,
      total,
    })
    .eq("id", invoiceId);

  if (invError) return { error: invError.message };

  // Delete + reinsert line items
  await supabase.from("invoice_line_items").delete().eq("invoice_id", invoiceId);

  const { error: itemsError } = await supabase.from("invoice_line_items").insert(
    lineItems.map((item, i) => ({
      tenant_id: profile.tenant_id,
      invoice_id: invoiceId,
      time_entry_id: item.time_entry_id || null,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
      sort_order: item.sort_order ?? i,
    }))
  );

  if (itemsError) return { error: itemsError.message };

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}`);
}

// ─── Send ─────────────────────────────────────────────────────────────────────

export async function sendInvoiceAction(invoiceId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return { error: "Unauthorized." };
  }

  // Fetch invoice + time entry IDs for marking billed
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, status, invoice_line_items(time_entry_id)")
    .eq("id", invoiceId)
    .single();

  if (!invoice) return { error: "Invoice not found." };
  if (!["draft", "sent"].includes(invoice.status)) {
    return { error: "Invoice cannot be sent from its current status." };
  }

  const { error: updError } = await supabase
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", invoiceId);

  if (updError) return { error: updError.message };

  // Mark linked time entries as billed
  const lineItems = invoice.invoice_line_items as unknown as { time_entry_id: string | null }[];
  const timeEntryIds = lineItems
    .map((li) => li.time_entry_id)
    .filter((id): id is string => !!id);

  if (timeEntryIds.length > 0) {
    await supabase
      .from("time_entries")
      .update({ billed: true, invoice_id: invoiceId })
      .in("id", timeEntryIds);
  }

  // Fire email (non-blocking)
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    fetch(`${appUrl}/api/email/invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId }),
    });
  } catch {
    // Email failure should not block the send action
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  return {};
}

// ─── Record payment ───────────────────────────────────────────────────────────

export async function recordPaymentAction(
  invoiceId: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return { error: "Unauthorized." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "Profile not found." };

  const amount = parseFloat(formData.get("amount") as string);
  const payment_date = formData.get("payment_date") as string;
  const payment_method = (formData.get("payment_method") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!amount || amount <= 0) return { error: "Amount must be greater than 0." };
  if (!payment_date) return { error: "Payment date is required." };

  const { error: insertError } = await supabase.from("payments").insert({
    tenant_id: profile.tenant_id,
    invoice_id: invoiceId,
    amount,
    payment_date,
    payment_method,
    notes,
  });

  if (insertError) return { error: insertError.message };

  // Recalculate amount_paid from all payments
  const { data: allPayments } = await supabase
    .from("payments")
    .select("amount")
    .eq("invoice_id", invoiceId);

  const amountPaid = (allPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  const { data: inv } = await supabase
    .from("invoices")
    .select("total")
    .eq("id", invoiceId)
    .single();

  const newStatus = inv && amountPaid >= Number(inv.total) ? "paid" : undefined;

  await supabase
    .from("invoices")
    .update({
      amount_paid: amountPaid,
      ...(newStatus ? { status: newStatus } : {}),
    })
    .eq("id", invoiceId);

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  return {};
}

// ─── Delete invoice (draft only) ─────────────────────────────────────────────

export async function deleteInvoiceAction(invoiceId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") return;

  const { data: existing } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .single();

  if (!existing || existing.status !== "draft") return;

  await supabase.from("invoices").delete().eq("id", invoiceId);

  revalidatePath("/invoices");
  redirect("/invoices");
}

// ─── Delete payment ───────────────────────────────────────────────────────────

export async function deletePaymentAction(
  paymentId: string,
  invoiceId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "admin") {
    return { error: "Unauthorized." };
  }

  await supabase.from("payments").delete().eq("id", paymentId);

  // Recalculate amount_paid
  const { data: allPayments } = await supabase
    .from("payments")
    .select("amount")
    .eq("invoice_id", invoiceId);

  const amountPaid = (allPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  const { data: inv } = await supabase
    .from("invoices")
    .select("total, status")
    .eq("id", invoiceId)
    .single();

  // Revert paid status if amount no longer covers total
  const revertStatus =
    inv?.status === "paid" && amountPaid < Number(inv.total) ? "sent" : undefined;

  await supabase
    .from("invoices")
    .update({
      amount_paid: amountPaid,
      ...(revertStatus ? { status: revertStatus } : {}),
    })
    .eq("id", invoiceId);

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  return {};
}
