import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(),
}));

import { updateSession } from "@/lib/supabase/middleware";
import { proxy, getTenantSlugFromHost } from "@/proxy";
import { encodePayload, makePayload, IMPERSONATION_COOKIE } from "@/lib/portal/impersonation";

const fakeResponse = new NextResponse(null, { status: 200 });

function makeRequest(
  pathname: string,
  cookies?: Record<string, string>,
  host?: string
): NextRequest {
  const req = new NextRequest(`http://${host ?? "localhost:3000"}${pathname}`, {
    headers: { host: host ?? "localhost:3000" },
  });
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
  delete process.env.NEXT_PUBLIC_BASE_DOMAIN;
});

// ── getTenantSlugFromHost ───────────────────────────────────────────────────

describe("getTenantSlugFromHost", () => {
  describe("with NEXT_PUBLIC_BASE_DOMAIN=taskflow.com", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_BASE_DOMAIN = "taskflow.com";
    });

    it("returns tenant slug from a valid subdomain", () => {
      expect(getTenantSlugFromHost("acme.taskflow.com")).toBe("acme");
    });

    it("returns null for www subdomain", () => {
      expect(getTenantSlugFromHost("www.taskflow.com")).toBeNull();
    });

    it("returns null for bare base domain", () => {
      expect(getTenantSlugFromHost("taskflow.com")).toBeNull();
    });

    it("returns null for localhost", () => {
      expect(getTenantSlugFromHost("localhost")).toBeNull();
    });

    it("returns null for localhost:3000", () => {
      expect(getTenantSlugFromHost("localhost:3000")).toBeNull();
    });

    it("returns null for an unrelated host", () => {
      expect(getTenantSlugFromHost("example.com")).toBeNull();
    });

    it("handles port in subdomain host correctly", () => {
      expect(getTenantSlugFromHost("acme.taskflow.com:3000")).toBe("acme");
    });
  });

  describe("without NEXT_PUBLIC_BASE_DOMAIN (local dev fallback to localhost)", () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_BASE_DOMAIN;
    });

    it("returns null for localhost", () => {
      expect(getTenantSlugFromHost("localhost")).toBeNull();
    });

    it("returns null for localhost:3000", () => {
      expect(getTenantSlugFromHost("localhost:3000")).toBeNull();
    });

    it("returns null for any host that does not include 'localhost'", () => {
      expect(getTenantSlugFromHost("acme.taskflow.com")).toBeNull();
    });
  });
});

// ── Admin route guard ──────────────────────────────────────────────────────

describe("proxy: admin routes", () => {
  const adminRoutes = [
    "/app/dashboard",
    "/app/clients",
    "/app/clients/123",
    "/app/tasks",
    "/app/tasks/AC-1",
    "/app/time",
    "/app/invoices",
    "/app/reports",
    "/app/settings",
  ];

  it("redirects unauthenticated users to /auth/login", async () => {
    for (const route of adminRoutes) {
      mockSession(null);
      const res = await proxy(makeRequest(route));
      expect(res.headers.get("location"), `route: ${route}`).toContain("/auth/login");
    }
  });

  it("redirects client role to /portal when hitting an admin route", async () => {
    mockSession({ id: "u1", app_metadata: { role: "client" } });
    const res = await proxy(makeRequest("/app/dashboard"));
    expect(res.headers.get("location")).toContain("/portal");
  });

  it("redirects client role with tenant_slug to /portal when hitting an admin route", async () => {
    mockSession({ id: "u1", app_metadata: { role: "client", tenant_slug: "acme" } });
    const res = await proxy(makeRequest("/app/dashboard"));
    expect(res.headers.get("location")).toContain("/portal");
  });

  it("passes through for admin role", async () => {
    mockSession({ id: "u1", app_metadata: { role: "admin" } });
    const res = await proxy(makeRequest("/app/dashboard"));
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

// ── x-tenant-slug header injection ────────────────────────────────────────

describe("proxy: x-tenant-slug header", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_BASE_DOMAIN = "taskflow.com";
  });

  it("injects x-tenant-slug from subdomain on pass-through", async () => {
    mockSession(null);
    const res = await proxy(makeRequest("/auth/login", undefined, "acme.taskflow.com"));
    expect(res.headers.get("x-tenant-slug")).toBe("acme");
  });

  it("injects empty x-tenant-slug for localhost", async () => {
    mockSession(null);
    const res = await proxy(makeRequest("/auth/login"));
    expect(res.headers.get("x-tenant-slug")).toBe("");
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
