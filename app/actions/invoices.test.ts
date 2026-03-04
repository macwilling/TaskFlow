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
import { redirect } from "next/navigation";
import {
  createInvoiceAction,
  sendInvoiceAction,
  recordPaymentAction,
  deleteInvoiceAction,
  updateInvoiceAction,
} from "@/app/actions/invoices";

const adminUser = { id: "user-1", app_metadata: { role: "admin" } };

const lineItems = JSON.stringify([
  { description: "Dev work", quantity: 8, unit_price: 100, amount: 800, sort_order: 0 },
]);

function makeInvoiceFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    client_id: "client-1",
    issue_date: "2026-03-01",
    due_date: "2026-04-01",
    memo: "",
    discount_type: "",
    discount_value: "0",
    tax_rate: "0",
    line_items: lineItems,
  };
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) {
    fd.append(k, v);
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetSupabaseMocks();
  (createClient as Mock).mockResolvedValue(mockSupabaseClient);
  (createAdminClient as Mock).mockReturnValue(mockAdminClient);
});

// ── createInvoiceAction ────────────────────────────────────────────────────

describe("createInvoiceAction", () => {
  it("returns Unauthorized when no user", async () => {
    const result = await createInvoiceAction(null, makeInvoiceFormData());
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns error when client_id is missing", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "t1" }, error: null })
    );
    const result = await createInvoiceAction(null, makeInvoiceFormData({ client_id: "" }));
    expect(result).toEqual({ error: "Client is required." });
  });

  it("returns error when issue_date is missing", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "t1" }, error: null })
    );
    const result = await createInvoiceAction(null, makeInvoiceFormData({ issue_date: "" }));
    expect(result).toEqual({ error: "Issue date is required." });
  });

  it("returns error when line_items is empty", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "t1" }, error: null })
    );
    const result = await createInvoiceAction(
      null,
      makeInvoiceFormData({ line_items: "[]" })
    );
    expect(result).toEqual({ error: "At least one line item is required." });
  });

  it("creates invoice and redirects on success", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "t1" }, error: null })
    );
    mockAdminClient.rpc.mockResolvedValueOnce({ data: "INV-1001", error: null });
    mockSupabaseFrom
      .mockReturnValueOnce(makeChain({ data: { id: "inv-1" }, error: null })) // invoices insert
      .mockReturnValueOnce(makeChain({ data: null, error: null })); // line items insert

    await createInvoiceAction(null, makeInvoiceFormData());

    expect(revalidatePath).toHaveBeenCalledWith("/invoices");
    expect(redirect).toHaveBeenCalledWith("/invoices/inv-1");
  });

  // Issue #30: tenant_id from profile used in invoice + line item inserts
  it("uses tenant_id from profile for invoice insert", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    const profileChain = makeChain({ data: { tenant_id: "profile-tenant" }, error: null });
    mockSupabaseFrom.mockReturnValueOnce(profileChain);
    mockAdminClient.rpc.mockResolvedValueOnce({ data: "INV-1001", error: null });
    const invoiceChain = makeChain({ data: { id: "inv-1" }, error: null });
    const lineChain = makeChain({ data: null, error: null });
    mockSupabaseFrom
      .mockReturnValueOnce(invoiceChain)
      .mockReturnValueOnce(lineChain);

    await createInvoiceAction(null, makeInvoiceFormData());

    expect(invoiceChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: "profile-tenant" })
    );
  });

  // Issue #34: tax and subtotal calculation
  it("correctly computes subtotal, taxAmount, and total", async () => {
    // Tax rate is stored and sent as a decimal fraction (0.1 = 10%)
    const items = JSON.stringify([
      { description: "A", quantity: 2, unit_price: 50, amount: 100, sort_order: 0 },
      { description: "B", quantity: 1, unit_price: 200, amount: 200, sort_order: 1 },
    ]);
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "t1" }, error: null })
    );
    mockAdminClient.rpc.mockResolvedValueOnce({ data: "INV-2000", error: null });
    const invoiceChain = makeChain({ data: { id: "inv-2" }, error: null });
    mockSupabaseFrom
      .mockReturnValueOnce(invoiceChain)
      .mockReturnValueOnce(makeChain({ data: null, error: null }));

    await createInvoiceAction(
      null,
      makeInvoiceFormData({ line_items: items, tax_rate: "0.1" })
    );

    // subtotal=300, tax=10% of 300=30, total=330
    expect(invoiceChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotal: 300,
        tax_amount: 30,
        total: 330,
        tax_rate: 0.1,
      })
    );
  });

  it("correctly applies flat discount before tax", async () => {
    // Flat $50 discount applied before 10% tax
    const items = JSON.stringify([
      { description: "A", quantity: 1, unit_price: 500, amount: 500, sort_order: 0 },
    ]);
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "t1" }, error: null })
    );
    mockAdminClient.rpc.mockResolvedValueOnce({ data: "INV-3000", error: null });
    const invoiceChain = makeChain({ data: { id: "inv-3" }, error: null });
    mockSupabaseFrom
      .mockReturnValueOnce(invoiceChain)
      .mockReturnValueOnce(makeChain({ data: null, error: null }));

    await createInvoiceAction(
      null,
      makeInvoiceFormData({
        line_items: items,
        discount_type: "flat",
        discount_value: "50",
        tax_rate: "0.1",
      })
    );

    // subtotal=500, discount=50, taxable=450, tax=45, total=495
    expect(invoiceChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotal: 500,
        tax_amount: 45,
        total: 495,
      })
    );
  });

  // Issue #34: claim_invoice_number call goes through admin client
  it("calls claim_invoice_number via admin rpc", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "t1" }, error: null })
    );
    mockAdminClient.rpc.mockResolvedValueOnce({ data: "INV-1001", error: null });
    mockSupabaseFrom
      .mockReturnValueOnce(makeChain({ data: { id: "inv-1" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }));

    await createInvoiceAction(null, makeInvoiceFormData());

    expect(mockAdminClient.rpc).toHaveBeenCalledWith("claim_invoice_number", {
      p_tenant_id: "t1",
    });
  });
});

// ── updateInvoiceAction ────────────────────────────────────────────────────

describe("updateInvoiceAction", () => {
  it("returns error when invoice is not draft", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom
      .mockReturnValueOnce(makeChain({ data: { tenant_id: "t1" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { status: "sent" }, error: null }));

    const result = await updateInvoiceAction("inv-1", null, makeInvoiceFormData());
    expect(result).toEqual({ error: "Only draft invoices can be edited." });
  });

  it("updates draft invoice and redirects on success", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom
      .mockReturnValueOnce(makeChain({ data: { tenant_id: "t1" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { status: "draft" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null })) // update invoices
      .mockReturnValueOnce(makeChain({ data: null, error: null })) // delete line items
      .mockReturnValueOnce(makeChain({ data: null, error: null })); // insert line items

    await updateInvoiceAction("inv-1", null, makeInvoiceFormData());

    expect(redirect).toHaveBeenCalledWith("/invoices/inv-1");
  });
});

// ── sendInvoiceAction ──────────────────────────────────────────────────────

describe("sendInvoiceAction", () => {
  it("returns Unauthorized when no user", async () => {
    const result = await sendInvoiceAction("inv-1");
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns error when invoice not found", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));
    const result = await sendInvoiceAction("inv-1");
    expect(result).toEqual({ error: "Invoice not found." });
  });

  // Issue #34: valid status transition draft→sent
  it("allows sending a draft invoice", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom
      .mockReturnValueOnce(
        makeChain({ data: { id: "inv-1", status: "draft", invoice_line_items: [] }, error: null })
      )
      .mockReturnValueOnce(makeChain({ data: null, error: null })); // update
    vi.stubGlobal("fetch", vi.fn());

    const result = await sendInvoiceAction("inv-1");
    expect(result).toEqual({});
    expect(revalidatePath).toHaveBeenCalledWith("/invoices/inv-1");
  });

  // Issue #34: valid status transition sent→sent (resend)
  it("allows re-sending a sent invoice", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom
      .mockReturnValueOnce(
        makeChain({ data: { id: "inv-1", status: "sent", invoice_line_items: [] }, error: null })
      )
      .mockReturnValueOnce(makeChain({ data: null, error: null }));
    vi.stubGlobal("fetch", vi.fn());

    const result = await sendInvoiceAction("inv-1");
    expect(result).toEqual({});
  });

  // Issue #34: invalid transition — paid invoice cannot be sent
  it("rejects sending a paid invoice", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { id: "inv-1", status: "paid", invoice_line_items: [] }, error: null })
    );

    const result = await sendInvoiceAction("inv-1");
    expect(result).toEqual({
      error: "Invoice cannot be sent from its current status.",
    });
  });

  it("marks linked time entries as billed", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    const updateInvoiceChain = makeChain({ data: null, error: null });
    const updateEntriesChain = makeChain({ data: null, error: null });
    mockSupabaseFrom
      .mockReturnValueOnce(
        makeChain({
          data: {
            id: "inv-1",
            status: "draft",
            invoice_line_items: [{ time_entry_id: "te-1" }, { time_entry_id: null }],
          },
          error: null,
        })
      )
      .mockReturnValueOnce(updateInvoiceChain)
      .mockReturnValueOnce(updateEntriesChain);
    vi.stubGlobal("fetch", vi.fn());

    await sendInvoiceAction("inv-1");

    expect(updateEntriesChain.in).toHaveBeenCalledWith("id", ["te-1"]);
    expect(updateEntriesChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ billed: true, invoice_id: "inv-1" })
    );
  });
});

// ── recordPaymentAction ────────────────────────────────────────────────────

describe("recordPaymentAction", () => {
  it("returns Unauthorized when no user", async () => {
    const fd = new FormData();
    fd.append("amount", "100");
    fd.append("payment_date", "2026-03-01");
    const result = await recordPaymentAction("inv-1", null, fd);
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns error when amount is zero", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "t1" }, error: null })
    );
    const fd = new FormData();
    fd.append("amount", "0");
    fd.append("payment_date", "2026-03-01");
    const result = await recordPaymentAction("inv-1", null, fd);
    expect(result).toEqual({ error: "Amount must be greater than 0." });
  });

  it("returns error when payment_date is missing", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "t1" }, error: null })
    );
    const fd = new FormData();
    fd.append("amount", "500");
    fd.append("payment_date", "");
    const result = await recordPaymentAction("inv-1", null, fd);
    expect(result).toEqual({ error: "Payment date is required." });
  });

  // Issue #34: payment marks invoice as paid when fully covered
  it("marks invoice as paid when total amount covered", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    const updateInvoiceChain = makeChain({ data: null, error: null });
    mockSupabaseFrom
      .mockReturnValueOnce(makeChain({ data: { tenant_id: "t1" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null })) // payments insert
      .mockReturnValueOnce(makeChain({ data: [{ amount: "500" }], error: null })) // fetch all payments
      .mockReturnValueOnce(makeChain({ data: { total: "500" }, error: null })) // fetch invoice total
      .mockReturnValueOnce(updateInvoiceChain); // update invoice

    const fd = new FormData();
    fd.append("amount", "500");
    fd.append("payment_date", "2026-03-01");
    await recordPaymentAction("inv-1", null, fd);

    expect(updateInvoiceChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "paid", amount_paid: 500 })
    );
  });

  it("does not mark as paid when partially covered", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    const updateInvoiceChain = makeChain({ data: null, error: null });
    mockSupabaseFrom
      .mockReturnValueOnce(makeChain({ data: { tenant_id: "t1" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: [{ amount: "200" }], error: null }))
      .mockReturnValueOnce(makeChain({ data: { total: "500" }, error: null }))
      .mockReturnValueOnce(updateInvoiceChain);

    const fd = new FormData();
    fd.append("amount", "200");
    fd.append("payment_date", "2026-03-01");
    await recordPaymentAction("inv-1", null, fd);

    expect(updateInvoiceChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ amount_paid: 200 })
    );
    expect(updateInvoiceChain.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "paid" })
    );
  });
});

// ── deleteInvoiceAction ────────────────────────────────────────────────────

describe("deleteInvoiceAction", () => {
  it("does nothing when unauthorized", async () => {
    await deleteInvoiceAction("inv-1");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("does nothing when invoice is not draft", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { status: "sent" }, error: null })
    );
    await deleteInvoiceAction("inv-1");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("deletes draft invoice and redirects to /invoices", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom
      .mockReturnValueOnce(makeChain({ data: { status: "draft" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }));

    await deleteInvoiceAction("inv-1");
    expect(revalidatePath).toHaveBeenCalledWith("/invoices");
    expect(redirect).toHaveBeenCalledWith("/invoices");
  });
});
