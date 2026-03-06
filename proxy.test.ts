import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(),
}));

import { updateSession } from "@/lib/supabase/middleware";
import { proxy } from "@/proxy";
import { encodePayload, makePayload, IMPERSONATION_COOKIE } from "@/lib/portal/impersonation";

const fakeResponse = new NextResponse(null, { status: 200 });

function makeRequest(pathname: string, cookies?: Record<string, string>): NextRequest {
  const req = new NextRequest(`http://localhost:3000${pathname}`);
  if (cookies) {
    Object.entries(cookies).forEach(([name, value]) => {
      req.cookies.set(name, value);
    });
  }
  return req;
}

function validImpersonationCookie(tenantSlug: string): string {
  return encodePayload(
    makePayload({
      clientId: "c1",
      userId: "portal-u1",
      tenantId: "t1",
      tenantSlug,
      clientName: "Acme Corp",
      adminUserId: "admin-1",
    })
  );
}

function mockSession(user: Record<string, unknown> | null) {
  (updateSession as Mock).mockResolvedValue({
    supabaseResponse: fakeResponse,
    user,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.ALLOW_REGISTRATION;
});

// ── Registration guard ─────────────────────────────────────────────────────

describe("proxy: /auth/register", () => {
  it("redirects to /auth/login when ALLOW_REGISTRATION is not true", async () => {
    process.env.ALLOW_REGISTRATION = "false";
    mockSession(null);
    const res = await proxy(makeRequest("/auth/register"));
    expect(res.headers.get("location")).toContain("/auth/login");
  });

  it("passes through when ALLOW_REGISTRATION=true", async () => {
    process.env.ALLOW_REGISTRATION = "true";
    mockSession(null);
    const res = await proxy(makeRequest("/auth/register"));
    expect(res).toBe(fakeResponse);
  });
});

// ── Admin route guard ──────────────────────────────────────────────────────

describe("proxy: admin routes", () => {
  const adminRoutes = [
    "/dashboard",
    "/clients",
    "/clients/123",
    "/tasks",
    "/tasks/AC-1",
    "/time",
    "/invoices",
    "/reports",
    "/settings",
  ];

  it("redirects unauthenticated users to /auth/login", async () => {
    for (const route of adminRoutes) {
      mockSession(null);
      const res = await proxy(makeRequest(route));
      expect(res.headers.get("location"), `route: ${route}`).toContain("/auth/login");
    }
  });

  it("redirects client role without tenant_slug to /auth/login", async () => {
    mockSession({ id: "u1", app_metadata: { role: "client" } });
    const res = await proxy(makeRequest("/dashboard"));
    expect(res.headers.get("location")).toContain("/auth/login");
  });

  it("redirects client role with tenant_slug to their portal", async () => {
    mockSession({ id: "u1", app_metadata: { role: "client", tenant_slug: "acme" } });
    const res = await proxy(makeRequest("/dashboard"));
    expect(res.headers.get("location")).toContain("/portal/acme");
  });

  it("passes through for admin role", async () => {
    mockSession({ id: "u1", app_metadata: { role: "admin" } });
    const res = await proxy(makeRequest("/dashboard"));
    expect(res).toBe(fakeResponse);
  });

  it("passes through for all admin sub-routes", async () => {
    for (const route of adminRoutes) {
      mockSession({ id: "u1", app_metadata: { role: "admin" } });
      const res = await proxy(makeRequest(route));
      expect(res, `route: ${route}`).toBe(fakeResponse);
    }
  });
});

// ── Portal route guard ─────────────────────────────────────────────────────

describe("proxy: portal routes", () => {
  it("redirects unauthenticated to /portal/[slug]/login", async () => {
    mockSession(null);
    const res = await proxy(makeRequest("/portal/acme"));
    expect(res.headers.get("location")).toContain("/portal/acme/login");
  });

  it("does NOT guard the login page itself", async () => {
    mockSession(null);
    const res = await proxy(makeRequest("/portal/acme/login"));
    // login page is not portal-protected, falls through
    expect(res).toBe(fakeResponse);
  });

  it("redirects admin role accessing portal to portal login (no cookie)", async () => {
    mockSession({ id: "u1", app_metadata: { role: "admin" } });
    const res = await proxy(makeRequest("/portal/acme/tasks"));
    expect(res.headers.get("location")).toContain("/portal/acme/login");
  });

  it("allows admin with valid impersonation cookie through portal route", async () => {
    mockSession({ id: "admin-1", app_metadata: { role: "admin" } });
    const cookie = validImpersonationCookie("acme");
    const res = await proxy(makeRequest("/portal/acme", { [IMPERSONATION_COOKIE]: cookie }));
    expect(res).toBe(fakeResponse);
  });

  it("blocks admin with impersonation cookie for wrong slug", async () => {
    mockSession({ id: "admin-1", app_metadata: { role: "admin" } });
    const cookie = validImpersonationCookie("other-co");
    const res = await proxy(makeRequest("/portal/acme", { [IMPERSONATION_COOKIE]: cookie }));
    expect(res.headers.get("location")).toContain("/portal/acme/login");
  });

  it("passes through for client role with matching slug", async () => {
    mockSession({
      id: "u1",
      app_metadata: { role: "client", tenant_slug: "acme" },
    });
    const res = await proxy(makeRequest("/portal/acme"));
    expect(res).toBe(fakeResponse);
  });

  it("redirects client to their own portal if slug mismatch", async () => {
    mockSession({
      id: "u1",
      app_metadata: { role: "client", tenant_slug: "myco" },
    });
    const res = await proxy(makeRequest("/portal/other-co"));
    expect(res.headers.get("location")).toContain("/portal/myco");
  });
});

// ── Non-guarded routes ─────────────────────────────────────────────────────

describe("proxy: non-guarded routes", () => {
  it("passes through public routes", async () => {
    mockSession(null);
    const res = await proxy(makeRequest("/auth/login"));
    expect(res).toBe(fakeResponse);
  });

  it("passes through / regardless of auth", async () => {
    mockSession(null);
    const res = await proxy(makeRequest("/"));
    expect(res).toBe(fakeResponse);
  });
});
