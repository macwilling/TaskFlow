import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  mockAdminClient,
  mockAdminFrom,
  mockAdminAuthAdmin,
  makeChain,
  resetSupabaseMocks,
} from "@/lib/supabase/__mocks__";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  getCachedUser: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), getAll: vi.fn(() => []) }),
}));

import { getCachedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET } from "@/app/api/portal/impersonate/route";
import { NextRequest } from "next/server";

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  app_metadata: { role: "admin", tenant_id: "t1" },
};

beforeEach(() => {
  resetSupabaseMocks();
  (createAdminClient as Mock).mockReturnValue(mockAdminClient);
});

function makeRequest(clientId?: string) {
  const url = clientId
    ? `http://localhost/api/portal/impersonate?clientId=${clientId}`
    : "http://localhost/api/portal/impersonate";
  return new NextRequest(url);
}

describe("GET /api/portal/impersonate", () => {
  it("redirects to /dashboard if no clientId", async () => {
    // Route exits before calling getCachedUser when clientId is absent
    const res = await GET(makeRequest());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/dashboard");
  });

  it("redirects to /auth/login if no user", async () => {
    (getCachedUser as Mock).mockResolvedValueOnce(null);
    const res = await GET(makeRequest("c1"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/login");
  });

  it("redirects to /auth/login if user is not admin", async () => {
    (getCachedUser as Mock).mockResolvedValueOnce({
      id: "u1",
      app_metadata: { role: "client" },
    });
    const res = await GET(makeRequest("c1"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/login");
  });

  it("redirects to client page if no portal access found", async () => {
    (getCachedUser as Mock).mockResolvedValueOnce(adminUser);
    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: null, error: null })); // no access

    const res = await GET(makeRequest("c1"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/clients/c1");
  });

  it("sets impersonation cookie and redirects to portal on success", async () => {
    (getCachedUser as Mock).mockResolvedValueOnce(adminUser);
    mockAdminFrom
      .mockReturnValueOnce(
        makeChain({ data: { user_id: "portal-u1", clients: { name: "Acme Corp" } }, error: null })
      )
      .mockReturnValueOnce(makeChain({ data: { slug: "acme" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null })); // audit log insert
    mockAdminAuthAdmin.getUserById = vi.fn();

    const res = await GET(makeRequest("c1"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/portal/acme");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("portal_impersonation");
  });
});
