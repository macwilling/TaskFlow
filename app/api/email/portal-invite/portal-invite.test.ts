import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Hoisted mocks ─────────────────────────────────────────────────────────

const mockEmailsSend = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockGetUser = vi.hoisted(() => vi.fn());
const mockGenerateLink = vi.hoisted(() => vi.fn());

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mockEmailsSend };
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: mockGetUser } }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
    auth: { admin: { generateLink: mockGenerateLink } },
  }),
}));

const adminUser = { id: "admin-1", app_metadata: { role: "admin" } };

// ── Helpers ───────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/email/portal-invite", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function mockSingle(data: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error: data ? null : { message: "not found" } }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

function mockEmailLogInsert() {
  return { insert: vi.fn().mockResolvedValue({ data: {}, error: null }) };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("POST /api/email/portal-invite", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    mockGetUser.mockResolvedValue({ data: { user: adminUser } });
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ clientId: "c1" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 when user is not an admin", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "u2", app_metadata: { role: "client" } } },
    });
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ clientId: "c1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when clientId is missing", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/missing clientId/i);
  });

  it("returns 404 when client is not found", async () => {
    mockFrom
      .mockReturnValueOnce(mockSingle({ tenant_id: "t1" })) // admin profile
      .mockReturnValueOnce(mockSingle(null));                 // client not found

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ clientId: "nonexistent" }));
    expect(res.status).toBe(404);
  });

  it("returns {skipped:true} when client has no email", async () => {
    mockFrom
      .mockReturnValueOnce(mockSingle({ tenant_id: "t1" }))
      .mockReturnValueOnce(mockSingle({ email: null, name: "Bob", tenant_id: "t1" }));

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ clientId: "c1" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.skipped).toBe(true);
    expect(mockEmailsSend).not.toHaveBeenCalled();
  });

  it("returns {sent:true} and logs email on success", async () => {
    mockFrom
      .mockReturnValueOnce(mockSingle({ tenant_id: "t1" }))
      .mockReturnValueOnce(
        mockSingle({ email: "client@example.com", name: "Alice", tenant_id: "t1" })
      )
      .mockReturnValueOnce(mockSingle({ slug: "acme" }))
      .mockReturnValueOnce(mockSingle({ business_name: "Acme Co" }))
      .mockReturnValueOnce(mockEmailLogInsert());

    mockGenerateLink.mockResolvedValueOnce({
      data: { properties: { action_link: "https://magic-link-url.example.com" } },
      error: null,
    });
    mockEmailsSend.mockResolvedValueOnce({ data: { id: "resend-abc" }, error: null });

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ clientId: "c1" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(true);

    const [emailArgs] = mockEmailsSend.mock.calls[0];
    expect(emailArgs.to).toBe("client@example.com");
    expect(emailArgs.subject).toContain("Acme Co");
    expect(emailArgs.html).toContain("https://magic-link-url.example.com");
    expect(emailArgs.html).toContain("Alice");
  });

  it("returns 500 when generateLink fails", async () => {
    mockFrom
      .mockReturnValueOnce(mockSingle({ tenant_id: "t1" }))
      .mockReturnValueOnce(
        mockSingle({ email: "client@example.com", name: "Alice", tenant_id: "t1" })
      )
      .mockReturnValueOnce(mockSingle({ slug: "acme" }))
      .mockReturnValueOnce(mockSingle({ business_name: "Acme Co" }));

    mockGenerateLink.mockResolvedValueOnce({
      data: null,
      error: { message: "token generation failed" },
    });

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ clientId: "c1" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/token generation failed/i);
  });

  it("returns 500 and logs failure when Resend send fails", async () => {
    mockFrom
      .mockReturnValueOnce(mockSingle({ tenant_id: "t1" }))
      .mockReturnValueOnce(
        mockSingle({ email: "client@example.com", name: "Alice", tenant_id: "t1" })
      )
      .mockReturnValueOnce(mockSingle({ slug: "acme" }))
      .mockReturnValueOnce(mockSingle({ business_name: "Acme Co" }))
      .mockReturnValueOnce(mockEmailLogInsert());

    mockGenerateLink.mockResolvedValueOnce({
      data: { properties: { action_link: "https://magic.example.com" } },
      error: null,
    });
    mockEmailsSend.mockResolvedValueOnce({
      data: null,
      error: { message: "Rate limit exceeded" },
    });

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ clientId: "c1" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/rate limit/i);
  });

  it("escapes HTML in client name and business name", async () => {
    mockFrom
      .mockReturnValueOnce(mockSingle({ tenant_id: "t1" }))
      .mockReturnValueOnce(
        mockSingle({ email: "client@example.com", name: "<b>Bob</b>", tenant_id: "t1" })
      )
      .mockReturnValueOnce(mockSingle({ slug: "acme" }))
      .mockReturnValueOnce(mockSingle({ business_name: "<Acme & Co>" }))
      .mockReturnValueOnce(mockEmailLogInsert());

    mockGenerateLink.mockResolvedValueOnce({
      data: { properties: { action_link: "https://magic.example.com" } },
      error: null,
    });
    mockEmailsSend.mockResolvedValueOnce({ data: { id: "r-1" }, error: null });

    const { POST } = await import("./route");
    await POST(makeRequest({ clientId: "c1" }));

    const [emailArgs] = mockEmailsSend.mock.calls[0];
    expect(emailArgs.html).not.toContain("<b>Bob</b>");
    expect(emailArgs.html).toContain("&lt;b&gt;Bob&lt;/b&gt;");
    expect(emailArgs.html).toContain("&lt;Acme &amp; Co&gt;");
  });
});
