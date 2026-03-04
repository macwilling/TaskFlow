import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  mockSupabaseClient,
  mockAdminClient,
  mockSupabaseFrom,
  mockAdminFrom,
  makeChain,
  resetSupabaseMocks,
} from "@/lib/supabase/__mocks__";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import {
  updateBusinessInfoAction,
  updateBrandingAction,
  updateInvoiceSettingsAction,
  updateEmailTemplatesAction,
  updateTenantSlugAction,
} from "@/app/actions/settings";

const adminUser = { id: "user-1", app_metadata: { role: "admin" } };

function makeAdminCtxMocks() {
  mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
    data: { user: adminUser },
    error: null,
  });
  mockSupabaseFrom.mockReturnValueOnce(
    makeChain({ data: { tenant_id: "tenant-1" }, error: null })
  );
}

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

beforeEach(() => {
  resetSupabaseMocks();
  (createClient as Mock).mockResolvedValue(mockSupabaseClient);
  (createAdminClient as Mock).mockReturnValue(mockAdminClient);
});

// ── updateBusinessInfoAction ───────────────────────────────────────────────

describe("updateBusinessInfoAction", () => {
  it("returns Unauthorized when no user", async () => {
    const result = await updateBusinessInfoAction(null, makeFormData({ business_name: "X" }));
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns DB error on update failure", async () => {
    makeAdminCtxMocks();
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: null, error: { message: "update failed" } })
    );
    const result = await updateBusinessInfoAction(
      null,
      makeFormData({ business_name: "Acme" })
    );
    expect(result).toEqual({ error: "update failed" });
  });

  it("updates business info and revalidates /settings", async () => {
    makeAdminCtxMocks();
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));

    const result = await updateBusinessInfoAction(
      null,
      makeFormData({ business_name: "Acme", email: "hi@acme.com", country: "US" })
    );
    expect(result).toEqual({});
    expect(revalidatePath).toHaveBeenCalledWith("/settings");
  });

  // Issue #30: update is scoped to tenant_id from session
  it("scopes update to tenant_id from session", async () => {
    makeAdminCtxMocks();
    const updateChain = makeChain({ data: null, error: null });
    mockSupabaseFrom.mockReturnValueOnce(updateChain);

    await updateBusinessInfoAction(null, makeFormData({ business_name: "Acme" }));

    expect(updateChain.eq).toHaveBeenCalledWith("tenant_id", "tenant-1");
  });
});

// ── updateBrandingAction ───────────────────────────────────────────────────

describe("updateBrandingAction", () => {
  it("returns Unauthorized when no user", async () => {
    const result = await updateBrandingAction(null, makeFormData({}));
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("updates branding and revalidates /settings", async () => {
    makeAdminCtxMocks();
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));

    const result = await updateBrandingAction(
      null,
      makeFormData({ primary_color: "#ff0000", accent_color: "#0000ff" })
    );
    expect(result).toEqual({});
    expect(revalidatePath).toHaveBeenCalledWith("/settings");
  });
});

// ── updateInvoiceSettingsAction ────────────────────────────────────────────

describe("updateInvoiceSettingsAction", () => {
  it("returns Unauthorized when no user", async () => {
    const result = await updateInvoiceSettingsAction(
      null,
      makeFormData({ invoice_number_next: "1001" })
    );
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns error when invoice_number_next is not a positive integer", async () => {
    makeAdminCtxMocks();
    const result = await updateInvoiceSettingsAction(
      null,
      makeFormData({
        invoice_number_next: "0",
        invoice_number_prefix: "INV-",
        default_payment_terms: "30",
        default_currency: "USD",
        default_tax_rate: "0",
        tax_label: "Tax",
        payment_method_options: "[]",
      })
    );
    expect(result).toEqual({ error: "Invoice number must be a positive integer." });
  });

  it("returns error when tax rate is out of range", async () => {
    makeAdminCtxMocks();
    const result = await updateInvoiceSettingsAction(
      null,
      makeFormData({
        invoice_number_next: "1001",
        invoice_number_prefix: "INV-",
        default_payment_terms: "30",
        default_currency: "USD",
        default_tax_rate: "101",
        tax_label: "Tax",
        payment_method_options: "[]",
      })
    );
    expect(result).toEqual({ error: "Tax rate must be between 0 and 100." });
  });

  it("returns error when payment_methods JSON is invalid", async () => {
    makeAdminCtxMocks();
    const result = await updateInvoiceSettingsAction(
      null,
      makeFormData({
        invoice_number_next: "1001",
        invoice_number_prefix: "INV-",
        default_payment_terms: "30",
        default_currency: "USD",
        default_tax_rate: "10",
        tax_label: "Tax",
        payment_method_options: "not-json",
      })
    );
    expect(result).toEqual({ error: "Invalid payment methods." });
  });

  it("updates invoice settings and revalidates /settings", async () => {
    makeAdminCtxMocks();
    const updateChain = makeChain({ data: null, error: null });
    mockSupabaseFrom.mockReturnValueOnce(updateChain);

    const result = await updateInvoiceSettingsAction(
      null,
      makeFormData({
        invoice_number_next: "1001",
        invoice_number_prefix: "INV-",
        default_payment_terms: "30",
        default_currency: "USD",
        default_tax_rate: "10",
        tax_label: "Tax",
        payment_method_options: '["Bank Transfer","PayPal"]',
      })
    );
    expect(result).toEqual({});
    expect(revalidatePath).toHaveBeenCalledWith("/settings");
    // tax rate stored as decimal
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ default_tax_rate: 0.1 })
    );
  });
});

// ── updateEmailTemplatesAction ─────────────────────────────────────────────

describe("updateEmailTemplatesAction", () => {
  it("returns Unauthorized when no user", async () => {
    const result = await updateEmailTemplatesAction(null, makeFormData({}));
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("updates email templates and revalidates /settings", async () => {
    makeAdminCtxMocks();
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));

    const result = await updateEmailTemplatesAction(
      null,
      makeFormData({
        email_sender_name: "Acme",
        email_reply_to: "hi@acme.com",
        email_task_closed_subject: "Task closed",
        email_task_closed_body: "Your task was closed.",
        email_invoice_subject: "Invoice",
        email_invoice_body: "See invoice.",
        email_comment_subject: "New comment",
        email_comment_body: "Someone commented.",
        email_signature: "Regards",
      })
    );
    expect(result).toEqual({});
    expect(revalidatePath).toHaveBeenCalledWith("/settings");
  });
});

// ── updateTenantSlugAction ─────────────────────────────────────────────────

describe("updateTenantSlugAction", () => {
  it("returns Unauthorized when no user", async () => {
    const result = await updateTenantSlugAction(null, makeFormData({ slug: "my-slug" }));
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns error for empty slug", async () => {
    makeAdminCtxMocks();
    const result = await updateTenantSlugAction(null, makeFormData({ slug: "" }));
    expect(result).toEqual({ error: "Slug is required." });
  });

  it("returns error for slug with invalid characters", async () => {
    makeAdminCtxMocks();
    const result = await updateTenantSlugAction(null, makeFormData({ slug: "My Slug!" }));
    expect(result).toEqual({
      error: "Slug may only contain lowercase letters, numbers, and hyphens.",
    });
  });

  it("returns early when slug is unchanged", async () => {
    makeAdminCtxMocks();
    mockAdminFrom.mockReturnValueOnce(
      makeChain({ data: { slug: "same-slug" }, error: null })
    );

    const result = await updateTenantSlugAction(null, makeFormData({ slug: "same-slug" }));
    expect(result).toEqual({});
  });

  it("returns error when slug is already taken", async () => {
    makeAdminCtxMocks();
    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: { slug: "old-slug" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { id: "other-tenant" }, error: null }));

    const result = await updateTenantSlugAction(null, makeFormData({ slug: "taken-slug" }));
    expect(result).toEqual({ error: "This slug is already taken. Please choose another." });
  });

  it("updates slug and revalidates /settings on success", async () => {
    makeAdminCtxMocks();
    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: { slug: "old-slug" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null })) // uniqueness check: no existing
      .mockReturnValueOnce(makeChain({ data: null, error: null })); // update

    const result = await updateTenantSlugAction(null, makeFormData({ slug: "new-slug" }));
    expect(result).toEqual({});
    expect(revalidatePath).toHaveBeenCalledWith("/settings");
  });
});
