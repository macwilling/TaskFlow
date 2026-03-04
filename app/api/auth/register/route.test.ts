import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  mockAdminClient,
  mockAdminFrom,
  mockAdminAuthAdmin,
  makeChain,
  resetSupabaseMocks,
} from "@/lib/supabase/__mocks__";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { POST } from "@/app/api/auth/register/route";
import { NextRequest } from "next/server";

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  resetSupabaseMocks();
  (createAdminClient as Mock).mockReturnValue(mockAdminClient);
  delete process.env.ALLOW_REGISTRATION;
});

describe("POST /api/auth/register", () => {
  it("returns 403 when ALLOW_REGISTRATION is not true", async () => {
    process.env.ALLOW_REGISTRATION = "false";
    const res = await POST(makeRequest({ businessName: "X", email: "a@b.com", password: "password1" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Registration is disabled.");
  });

  it("returns 400 when fields are missing", async () => {
    process.env.ALLOW_REGISTRATION = "true";
    const res = await POST(makeRequest({ email: "a@b.com", password: "password1" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("All fields are required.");
  });

  it("returns 400 when password is too short", async () => {
    process.env.ALLOW_REGISTRATION = "true";
    const res = await POST(makeRequest({ businessName: "X", email: "a@b.com", password: "short" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Password must be at least 8 characters.");
  });

  it("returns 400 when user creation fails (e.g., duplicate email)", async () => {
    process.env.ALLOW_REGISTRATION = "true";
    mockAdminAuthAdmin.createUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Email already registered." },
    });

    const res = await POST(makeRequest({ businessName: "X", email: "dup@b.com", password: "password1" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Email already registered.");
  });

  it("creates user, tenant, profile, and settings on success", async () => {
    process.env.ALLOW_REGISTRATION = "true";
    mockAdminAuthAdmin.createUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
      error: null,
    });
    // tenants select (slug uniqueness)
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [], error: null }));
    // tenants insert
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: { id: "tenant-1" }, error: null }));
    // profiles insert
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));
    // tenant_settings insert
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));
    // updateUserById (app_metadata)
    mockAdminAuthAdmin.updateUserById.mockResolvedValueOnce({ error: null });

    const res = await POST(
      makeRequest({ businessName: "Acme Corp", email: "admin@acme.com", password: "securepass" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    expect(mockAdminAuthAdmin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "admin@acme.com", email_confirm: true })
    );
    expect(mockAdminAuthAdmin.updateUserById).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        app_metadata: expect.objectContaining({ role: "admin" }),
      })
    );
  });

  it("deletes auth user and returns 500 if tenant creation fails", async () => {
    process.env.ALLOW_REGISTRATION = "true";
    mockAdminAuthAdmin.createUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
      error: null,
    });
    // slug uniqueness check
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [], error: null }));
    // tenants insert fails
    mockAdminFrom.mockReturnValueOnce(
      makeChain({ data: null, error: { message: "insert failed" } })
    );
    mockAdminAuthAdmin.deleteUser.mockResolvedValueOnce({ error: null });

    const res = await POST(
      makeRequest({ businessName: "Acme", email: "a@b.com", password: "password1" })
    );
    expect(res.status).toBe(500);
    expect(mockAdminAuthAdmin.deleteUser).toHaveBeenCalledWith("user-1");
  });

  it("generates slug from business name", async () => {
    process.env.ALLOW_REGISTRATION = "true";
    mockAdminAuthAdmin.createUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: [], error: null })) // uniqueness check
      .mockReturnValueOnce(makeChain({ data: { id: "t1" }, error: null })) // tenants insert
      .mockReturnValueOnce(makeChain({ data: null, error: null })) // profiles
      .mockReturnValueOnce(makeChain({ data: null, error: null })); // settings
    mockAdminAuthAdmin.updateUserById.mockResolvedValueOnce({ error: null });

    await POST(makeRequest({ businessName: "Acme Corp!", email: "a@b.com", password: "password1" }));

    // Slug should be "acme-corp" (special chars stripped, spaces → hyphens)
    const tenantInsertChain = mockAdminFrom.mock.results[1].value;
    expect(tenantInsertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "acme-corp" })
    );
  });
});
