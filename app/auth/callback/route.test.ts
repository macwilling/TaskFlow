import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  mockSupabaseClient,
  mockAdminClient,
  mockSupabaseFrom,
  mockAdminFrom,
  mockAdminAuthAdmin,
  makeChain,
  resetSupabaseMocks,
} from "@/lib/supabase/__mocks__";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET } from "@/app/auth/callback/route";
import { NextRequest } from "next/server";

function makeRequest(search: Record<string, string>): NextRequest {
  const params = new URLSearchParams(search);
  return new NextRequest(`http://localhost:3000/auth/callback?${params}`);
}

beforeEach(() => {
  resetSupabaseMocks();
  (createClient as Mock).mockResolvedValue(mockSupabaseClient);
  (createAdminClient as Mock).mockReturnValue(mockAdminClient);
  delete process.env.ALLOW_REGISTRATION;
});

// ── No code ────────────────────────────────────────────────────────────────

describe("GET /auth/callback", () => {
  it("redirects to login error when no code", async () => {
    const res = await GET(makeRequest({}));
    expect(res.headers.get("location")).toContain("/auth/login?error=auth_callback_error");
  });

  it("redirects to login error when code exchange fails", async () => {
    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValueOnce({
      error: { message: "expired" },
    });
    const res = await GET(makeRequest({ code: "bad-code" }));
    expect(res.headers.get("location")).toContain("/auth/login?error=auth_callback_error");
  });

  it("redirects to login error when user is null after exchange", async () => {
    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    const res = await GET(makeRequest({ code: "ok-code" }));
    expect(res.headers.get("location")).toContain("/auth/login?error=auth_callback_error");
  });

  // ── Returning users ──────────────────────────────────────────────────────

  it("redirects admin returning user to /dashboard", async () => {
    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "u1", app_metadata: { role: "admin" } } },
      error: null,
    });
    // existing profile
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { id: "u1", role: "admin" }, error: null })
    );

    const res = await GET(makeRequest({ code: "ok-code" }));
    expect(res.headers.get("location")).toContain("/dashboard");
  });

  it("redirects returning client to their portal", async () => {
    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "u1",
          app_metadata: { role: "client", tenant_slug: "acme" },
        },
      },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { id: "u1", role: "client" }, error: null })
    );

    const res = await GET(makeRequest({ code: "ok-code" }));
    expect(res.headers.get("location")).toContain("/portal/acme");
  });

  it("redirects to login error when returning client has no tenant_slug", async () => {
    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "u1", app_metadata: { role: "client" } } },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { id: "u1", role: "client" }, error: null })
    );

    const res = await GET(makeRequest({ code: "ok-code" }));
    expect(res.headers.get("location")).toContain("error=auth_callback_error");
  });

  // ── Portal first-time sign-in (OTP or Google OAuth) ───────────────────────

  it("creates client profile on first portal sign-in when email matches a client (no existing access row)", async () => {
    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "oauth-user",
          email: "client@example.com",
          app_metadata: {},
          user_metadata: { name: "Client Name" },
        },
      },
      error: null,
    });
    // no existing profile
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));
    // admin: tenant lookup by slug
    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: { id: "t1", slug: "acme" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { id: "c1" }, error: null })) // clients match
      .mockReturnValueOnce(makeChain({ data: null, error: null }))         // profiles insert
      .mockReturnValueOnce(makeChain({ data: null, error: null }))         // no existing access row
      .mockReturnValueOnce(makeChain({ data: null, error: null }));        // access insert
    mockAdminAuthAdmin.updateUserById.mockResolvedValueOnce({ error: null });

    const res = await GET(makeRequest({ code: "ok-code", next: "/portal/acme" }));
    expect(res.headers.get("location")).toContain("/portal/acme");
  });

  it("updates existing pending access row on first OTP sign-in", async () => {
    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "otp-user",
          email: "client@example.com",
          app_metadata: {},
          user_metadata: {},
        },
      },
      error: null,
    });
    // no existing profile
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));

    const updateAccessChain = makeChain({ data: null, error: null });

    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: { id: "t1", slug: "acme" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { id: "c1" }, error: null }))          // client match
      .mockReturnValueOnce(makeChain({ data: null, error: null }))                  // profiles insert
      .mockReturnValueOnce(makeChain({ data: { id: "existing-row" }, error: null })) // existing access
      .mockReturnValueOnce(updateAccessChain);                                       // update access
    mockAdminAuthAdmin.updateUserById.mockResolvedValueOnce({ error: null });

    const res = await GET(makeRequest({ code: "ok-code", next: "/portal/acme" }));
    expect(res.headers.get("location")).toContain("/portal/acme");
    // Should UPDATE not INSERT when row exists
    expect(updateAccessChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "otp-user", accepted_at: expect.any(String) })
    );
  });

  it("returns not_invited when email doesn't match any client", async () => {
    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "oauth-user",
          email: "unknown@example.com",
          app_metadata: {},
          user_metadata: {},
        },
      },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));
    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: { id: "t1", slug: "acme" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null })); // no client match
    mockSupabaseClient.auth.signOut.mockResolvedValueOnce({});

    const res = await GET(makeRequest({ code: "ok-code", next: "/portal/acme" }));
    expect(res.headers.get("location")).toContain("error=not_invited");
  });

  it("redirects to login error when portal tenant not found", async () => {
    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "u1",
          email: "c@example.com",
          app_metadata: {},
          user_metadata: {},
        },
      },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: null })); // tenant not found
    mockSupabaseClient.auth.signOut.mockResolvedValueOnce({});

    const res = await GET(makeRequest({ code: "ok-code", next: "/portal/bad-slug" }));
    expect(res.headers.get("location")).toContain("error=auth_callback_error");
  });

  // ── First-time OAuth admin sign-in ────────────────────────────────────────

  it("creates new tenant for first-time admin OAuth when registration is enabled", async () => {
    process.env.ALLOW_REGISTRATION = "true";
    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "new-admin",
          email: "admin@newco.com",
          app_metadata: {},
          user_metadata: { full_name: "New Admin" },
        },
      },
      error: null,
    });
    // no existing profile
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));
    // admin: slug uniqueness + tenant insert + profile + settings
    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: [], error: null })) // slug uniqueness
      .mockReturnValueOnce(makeChain({ data: { id: "new-tenant" }, error: null })) // tenant insert
      .mockReturnValueOnce(makeChain({ data: null, error: null })) // profiles
      .mockReturnValueOnce(makeChain({ data: null, error: null })); // settings
    mockAdminAuthAdmin.updateUserById.mockResolvedValueOnce({ error: null });

    const res = await GET(makeRequest({ code: "ok-code" }));
    expect(res.headers.get("location")).toContain("/dashboard");
    expect(mockAdminAuthAdmin.updateUserById).toHaveBeenCalledWith(
      "new-admin",
      expect.objectContaining({
        app_metadata: expect.objectContaining({ role: "admin" }),
      })
    );
  });

  it("rejects first-time OAuth when registration is disabled", async () => {
    process.env.ALLOW_REGISTRATION = "false";
    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "new-user",
          email: "new@example.com",
          app_metadata: {},
          user_metadata: {},
        },
      },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));
    mockSupabaseClient.auth.signOut.mockResolvedValueOnce({});

    const res = await GET(makeRequest({ code: "ok-code" }));
    expect(res.headers.get("location")).toContain("error=registration_disabled");
  });
});
