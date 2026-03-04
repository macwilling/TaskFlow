"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult = { error?: string };

async function getAdminCtx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "admin") return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  return { supabase, tenantId: profile.tenant_id as string };
}

export async function updateBusinessInfoAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const ctx = await getAdminCtx();
  if (!ctx) return { error: "Unauthorized." };

  const get = (k: string) => (formData.get(k) as string) ?? "";

  const { error } = await ctx.supabase
    .from("tenant_settings")
    .update({
      business_name: get("business_name").trim() || null,
      address_line1: get("address_line1").trim() || null,
      address_line2: get("address_line2").trim() || null,
      city: get("city").trim() || null,
      state: get("state").trim() || null,
      postal_code: get("postal_code").trim() || null,
      country: get("country").trim() || "US",
      email: get("email").trim() || null,
      phone: get("phone").trim() || null,
    })
    .eq("tenant_id", ctx.tenantId);

  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}

export async function updateBrandingAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const ctx = await getAdminCtx();
  if (!ctx) return { error: "Unauthorized." };

  const logo_url = (formData.get("logo_url") as string) ?? "";
  const primary_color = (formData.get("primary_color") as string) ?? "#0969da";
  const accent_color = (formData.get("accent_color") as string) ?? "#0550ae";
  const portal_welcome_message = (formData.get("portal_welcome_message") as string) ?? "";

  const update: Record<string, unknown> = {
    primary_color: primary_color || "#0969da",
    accent_color: accent_color || "#0550ae",
    portal_welcome_message: portal_welcome_message.trim() || null,
  };
  if (logo_url.trim()) {
    update.logo_url = logo_url.trim();
  }

  const { error } = await ctx.supabase
    .from("tenant_settings")
    .update(update)
    .eq("tenant_id", ctx.tenantId);

  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}

export async function updateInvoiceSettingsAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const ctx = await getAdminCtx();
  if (!ctx) return { error: "Unauthorized." };

  const prefix = (formData.get("invoice_number_prefix") as string) ?? "INV-";
  const nextStr = (formData.get("invoice_number_next") as string) ?? "1001";
  const termsStr = (formData.get("default_payment_terms") as string) ?? "30";
  const currency = (formData.get("default_currency") as string) ?? "USD";
  const taxRateStr = (formData.get("default_tax_rate") as string) ?? "0";
  const taxLabel = (formData.get("tax_label") as string) ?? "Tax";
  const paymentMethodsJson = (formData.get("payment_method_options") as string) ?? "[]";

  const invoiceNext = parseInt(nextStr);
  if (isNaN(invoiceNext) || invoiceNext < 1)
    return { error: "Invoice number must be a positive integer." };

  const terms = parseInt(termsStr);
  if (isNaN(terms) || terms < 0)
    return { error: "Payment terms must be a non-negative integer." };

  const taxRate = parseFloat(taxRateStr);
  if (isNaN(taxRate) || taxRate < 0 || taxRate > 100)
    return { error: "Tax rate must be between 0 and 100." };

  let paymentMethods: string[];
  try {
    paymentMethods = JSON.parse(paymentMethodsJson);
    if (!Array.isArray(paymentMethods)) throw new Error();
  } catch {
    return { error: "Invalid payment methods." };
  }

  const { error } = await ctx.supabase
    .from("tenant_settings")
    .update({
      invoice_number_prefix: prefix.trim() || "INV-",
      invoice_number_next: invoiceNext,
      default_payment_terms: terms,
      default_currency: currency || "USD",
      default_tax_rate: taxRate / 100, // stored as 0–1 decimal
      tax_label: taxLabel.trim() || "Tax",
      payment_method_options: paymentMethods,
    })
    .eq("tenant_id", ctx.tenantId);

  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}

export async function updateEmailTemplatesAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const ctx = await getAdminCtx();
  if (!ctx) return { error: "Unauthorized." };

  const get = (k: string) => (formData.get(k) as string) ?? "";

  const { error } = await ctx.supabase
    .from("tenant_settings")
    .update({
      email_sender_name: get("email_sender_name").trim() || null,
      email_reply_to: get("email_reply_to").trim() || null,
      email_task_closed_subject: get("email_task_closed_subject").trim() || null,
      email_task_closed_body: get("email_task_closed_body").trim() || null,
      email_invoice_subject: get("email_invoice_subject").trim() || null,
      email_invoice_body: get("email_invoice_body").trim() || null,
      email_comment_subject: get("email_comment_subject").trim() || null,
      email_comment_body: get("email_comment_body").trim() || null,
      email_signature: get("email_signature").trim() || null,
    })
    .eq("tenant_id", ctx.tenantId);

  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}

export async function updateTenantSlugAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const ctx = await getAdminCtx();
  if (!ctx) return { error: "Unauthorized." };

  const slug = ((formData.get("slug") as string) ?? "").trim().toLowerCase();
  if (!slug) return { error: "Slug is required." };
  if (!/^[a-z0-9-]+$/.test(slug))
    return { error: "Slug may only contain lowercase letters, numbers, and hyphens." };

  const admin = createAdminClient();

  // Check current slug
  const { data: tenant } = await admin
    .from("tenants")
    .select("slug")
    .eq("id", ctx.tenantId)
    .single();
  if (!tenant) return { error: "Tenant not found." };
  if (tenant.slug === slug) return {}; // no change

  // Uniqueness check
  const { data: existing } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return { error: "This slug is already taken. Please choose another." };

  const { error } = await admin
    .from("tenants")
    .update({ slug })
    .eq("id", ctx.tenantId);

  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}
