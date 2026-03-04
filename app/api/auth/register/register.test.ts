import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mockCreateUser = vi.hoisted(() => vi.fn());
const mockUpdateUserById = vi.hoisted(() => vi.fn());
const mockDeleteUser = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
        updateUserById: mockUpdateUserById,
        deleteUser: mockDeleteUser,
      },
    },
    from: mockFrom,
  }),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

/** Builds a chainable Supabase query mock for `.from()` calls */
function makeChain(result: { data?: unknown; error?: { message: string } | null }) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "insert", "eq", "single"];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: result.data ?? null,
    error: result.error ?? null,
  });
  (chain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: result.data ?? [],
    error: result.error ?? null,
  });
  return chain;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/auth/register", () => {
  const originalEnv = process.env.ALLOW_REGISTRATION;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.ALLOW_REGISTRATION = "true";
  });

  afterEach(() => {
    process.env.ALLOW_REGISTRATION = originalEnv;
  });

  it("returns 403 when ALLOW_REGISTRATION is not 'true'", async () => {
    process.env.ALLOW_REGISTRATION = "false";
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ businessName: "Acme", email: "a@b.com", password: "secret123" }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/disabled/i);
  });

  it("returns 400 when required fields are missing", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ email: "a@b.com" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/required/i);
  });

  it("returns 400 when password is shorter than 8 characters", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ businessName: "Acme", email: "a@b.com", password: "short" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/8 characters/i);
  });

  it("returns 400 when Supabase createUser fails (e.g. duplicate email)", async () => {
    mockCreateUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "User already registered" },
    });

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ businessName: "Acme", email: "dup@b.com", password: "secret123" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/already registered/i);
  });

  it("returns 200 and success:true on the happy path", async () => {
    const userId = "user-abc";
    const tenantId = "tenant-xyz";

    mockCreateUser.mockResolvedValueOnce({ data: { user: { id: userId } }, error: null });
    mockUpdateUserById.mockResolvedValueOnce({ data: {}, error: null });

    // from("tenants").select("slug").eq(...) — no existing slug
    const selectChain = makeChain({ data: [] });
    // from("tenants").insert(...).select("id").single() — returns tenant
    const insertTenantChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: tenantId }, error: null }),
    };
    // from("profiles").insert(...) — success
    const insertProfileChain = { insert: vi.fn().mockResolvedValue({ data: {}, error: null }) };
    // from("tenant_settings").insert(...) — success
    const insertSettingsChain = { insert: vi.fn().mockResolvedValue({ data: {}, error: null }) };

    mockFrom
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(insertTenantChain)
      .mockReturnValueOnce(insertProfileChain)
      .mockReturnValueOnce(insertSettingsChain);

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ businessName: "Acme Corp", email: "new@b.com", password: "secret123" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("returns 500 and cleans up auth user when a downstream step fails", async () => {
    const userId = "user-fail";

    mockCreateUser.mockResolvedValueOnce({ data: { user: { id: userId } }, error: null });
    mockDeleteUser.mockResolvedValueOnce({ data: {}, error: null });

    // from("tenants").select — no existing slug
    const selectChain = makeChain({ data: [] });
    // from("tenants").insert — fails
    const insertTenantChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
    };

    mockFrom
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(insertTenantChain);

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ businessName: "Fail Corp", email: "fail@b.com", password: "secret123" }));
    expect(res.status).toBe(500);
    expect(mockDeleteUser).toHaveBeenCalledWith(userId);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });
});
