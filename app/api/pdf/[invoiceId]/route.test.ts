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
vi.mock("@react-pdf/renderer", () => ({
  renderToBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
}));
vi.mock("@/components/invoices/InvoicePDF", () => ({
  InvoicePDF: vi.fn(() => null),
}));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderToBuffer } from "@react-pdf/renderer";
import { GET } from "@/app/api/pdf/[invoiceId]/route";
import { NextRequest } from "next/server";

const adminUser = { id: "user-1", app_metadata: { role: "admin" } };

const fakeInvoice = {
  id: "inv-1",
  invoice_number: "INV-1001",
  status: "sent",
  issue_date: "2026-03-01",
  due_date: "2026-04-01",
  memo: null,
  subtotal: 800,
  discount_type: null,
  discount_value: null,
  tax_rate: 0,
  tax_amount: 0,
  total: 800,
  amount_paid: 0,
  clients: { name: "Acme Corp", email: "acme@example.com", billing_address: null },
  invoice_line_items: [
    { description: "Dev", quantity: 8, unit_price: 100, amount: 800, sort_order: 0 },
  ],
};

const fakeSettings = {
  business_name: "My Consulting",
  address_line1: "123 Main St",
  address_line2: null,
  city: "Springfield",
  state: "IL",
  postal_code: "62701",
  email: "me@consulting.com",
  phone: null,
  tax_label: "Tax",
  payment_method_options: null,
};

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/pdf/inv-1");
}

function makeParams(invoiceId: string) {
  return { params: Promise.resolve({ invoiceId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetSupabaseMocks();
  (createClient as Mock).mockResolvedValue(mockSupabaseClient);
  (createAdminClient as Mock).mockReturnValue(mockAdminClient);
  (renderToBuffer as Mock).mockResolvedValue(Buffer.from("fake-pdf"));
});

describe("GET /api/pdf/[invoiceId]", () => {
  it("returns 401 when no user", async () => {
    const res = await GET(makeRequest(), makeParams("inv-1"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when user is not admin", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "u1", app_metadata: { role: "client" } } },
      error: null,
    });
    const res = await GET(makeRequest(), makeParams("inv-1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when invoice not found", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockAdminFrom.mockReturnValueOnce(
      makeChain({ data: null, error: { message: "not found" } })
    );
    const res = await GET(makeRequest(), makeParams("inv-1"));
    expect(res.status).toBe(404);
  });

  it("returns 403 when invoice belongs to different tenant", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    // invoice fetch
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: fakeInvoice, error: null }));
    // profile fetch
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "tenant-A" }, error: null })
    );
    // invoice tenant_id fetch
    mockAdminFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "tenant-B" }, error: null })
    );

    const res = await GET(makeRequest(), makeParams("inv-1"));
    expect(res.status).toBe(403);
  });

  it("returns PDF with correct headers on success", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    // invoice fetch
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: fakeInvoice, error: null }));
    // profile fetch
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "tenant-1" }, error: null })
    );
    // invoice tenant_id
    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: { tenant_id: "tenant-1" }, error: null }))
      // settings
      .mockReturnValueOnce(makeChain({ data: fakeSettings, error: null }));

    const res = await GET(makeRequest(), makeParams("inv-1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toBe(
      `inline; filename="${fakeInvoice.invoice_number}.pdf"`
    );
  });

  it("calls renderToBuffer with correct invoice props", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: fakeInvoice, error: null }));
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "tenant-1" }, error: null })
    );
    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: { tenant_id: "tenant-1" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: fakeSettings, error: null }));

    await GET(makeRequest(), makeParams("inv-1"));

    // renderToBuffer should have been called with the React element
    expect(renderToBuffer).toHaveBeenCalledWith(expect.anything());
  });

  // Issue #34: overdue is computed dynamically — test the contract via status field
  it("passes invoice status (not overdue) directly to PDF component", async () => {
    const sentInvoice = { ...fakeInvoice, status: "sent" };
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: sentInvoice, error: null }));
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "tenant-1" }, error: null })
    );
    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: { tenant_id: "tenant-1" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: fakeSettings, error: null }));

    await GET(makeRequest(), makeParams("inv-1"));

    // The stored status is passed through; overdue is computed at display layer
    const callArg = (renderToBuffer as Mock).mock.calls[0][0];
    expect(callArg.props.invoice.status).toBe("sent");
  });
});
