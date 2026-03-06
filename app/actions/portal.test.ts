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

// Hoist the Resend mock so it's available before vi.mock hoisting
const mockEmailsSend = vi.hoisted(() => vi.fn());

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mockEmailsSend };
  },
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import {
  sendPortalSignInLinkAction,
  revokePortalAccessAction,
} from "@/app/actions/portal";

const adminUser = { id: "admin-1", app_metadata: { role: "admin" } };

beforeEach(() => {
  resetSupabaseMocks();
  (createClient as Mock).mockResolvedValue(mockSupabaseClient);
  (createAdminClient as Mock).mockReturnValue(mockAdminClient);
  mockEmailsSend.mockReset();
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
  process.env.RESEND_API_KEY = "test-key";
});

// ── sendPortalSignInLinkAction ─────────────────────────────────────────────

describe("sendPortalSignInLinkAction", () => {
  it("returns Unauthorized when no user", async () => {
    const result = await sendPortalSignInLinkAction("c1", null);
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns Unauthorized when profile role is not admin", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "t1", role: "client" }, error: null })
    );
    const result = await sendPortalSignInLinkAction("c1", null);
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns error when client email not found", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom
      .mockReturnValueOnce(makeChain({ data: { tenant_id: "t1", role: "admin" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { email: null, name: "Bob" }, error: null }));

    const result = await sendPortalSignInLinkAction("c1", null);
    expect(result).toEqual({ error: "Client email not found." });
  });

  it("returns error when tenant not found", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom
      .mockReturnValueOnce(makeChain({ data: { tenant_id: "t1", role: "admin" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { email: "c@example.com", name: "Bob" }, error: null }));
    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: null, error: null })); // tenant not found

    const result = await sendPortalSignInLinkAction("c1", null);
    expect(result).toEqual({ error: "Tenant not found." });
  });

  it("inserts pending portal_access row on first grant", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom
      .mockReturnValueOnce(makeChain({ data: { tenant_id: "t1", role: "admin" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { email: "c@example.com", name: "Bob" }, error: null }));

    const insertAccessChain = makeChain({ data: null, error: null });
    const insertEmailLogChain = makeChain({ data: null, error: null });

    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: { slug: "acme" }, error: null }))      // tenant
      .mockReturnValueOnce(makeChain({ data: { business_name: "Acme Co" }, error: null })) // settings
      .mockReturnValueOnce(makeChain({ data: null, error: null }))                  // no existing access
      .mockReturnValueOnce(insertAccessChain)                                       // insert access row
      .mockReturnValueOnce(insertEmailLogChain);                                    // email_log insert

    mockAdminAuthAdmin.generateLink.mockResolvedValueOnce({
      data: { properties: { action_link: "https://supabase.co/magic-link" } },
      error: null,
    });
    mockEmailsSend.mockResolvedValueOnce({ data: { id: "resend-1" }, error: null });

    const result = await sendPortalSignInLinkAction("c1", null);
    expect(result).toEqual({ success: true });
    expect(insertAccessChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: "c1", tenant_id: "t1", invited_at: expect.any(String) })
    );
  });

  it("skips row insertion on resend (row already exists)", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom
      .mockReturnValueOnce(makeChain({ data: { tenant_id: "t1", role: "admin" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { email: "c@example.com", name: "Bob" }, error: null }));

    const insertEmailLogChain = makeChain({ data: null, error: null });

    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: { slug: "acme" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { business_name: "Acme Co" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { id: "existing-row" }, error: null })) // existing access
      .mockReturnValueOnce(insertEmailLogChain);                                     // email_log insert

    mockAdminAuthAdmin.generateLink.mockResolvedValueOnce({
      data: { properties: { action_link: "https://supabase.co/magic-link" } },
      error: null,
    });
    mockEmailsSend.mockResolvedValueOnce({ data: { id: "resend-1" }, error: null });

    const result = await sendPortalSignInLinkAction("c1", null);
    expect(result).toEqual({ success: true });
    // Only 4 admin.from calls (tenant, settings, existing check, email_log) — no insert
    expect(mockAdminFrom).toHaveBeenCalledTimes(4);
  });

  it("sends branded Resend email with magic link", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom
      .mockReturnValueOnce(makeChain({ data: { tenant_id: "t1", role: "admin" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { email: "c@example.com", name: "Bob" }, error: null }));
    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: { slug: "acme" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { business_name: "Acme Co" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))  // no existing access
      .mockReturnValueOnce(makeChain({ data: null, error: null }))  // insert access
      .mockReturnValueOnce(makeChain({ data: null, error: null })); // email_log
    mockAdminAuthAdmin.generateLink.mockResolvedValueOnce({
      data: { properties: { action_link: "https://supabase.co/magic-link-url" } },
      error: null,
    });
    mockEmailsSend.mockResolvedValueOnce({ data: { id: "r-1" }, error: null });

    await sendPortalSignInLinkAction("c1", null);

    expect(mockAdminAuthAdmin.generateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "magiclink",
        email: "c@example.com",
        options: expect.objectContaining({ redirectTo: expect.stringContaining("/portal/acme") }),
      })
    );

    const [emailArgs] = mockEmailsSend.mock.calls[0];
    expect(emailArgs.to).toBe("c@example.com");
    expect(emailArgs.subject).toContain("Acme Co");
    expect(emailArgs.html).toContain("https://supabase.co/magic-link-url");
    expect(emailArgs.html).toContain("Bob");
  });

  it("returns error when generateLink fails", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom
      .mockReturnValueOnce(makeChain({ data: { tenant_id: "t1", role: "admin" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { email: "c@example.com", name: "Bob" }, error: null }));
    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: { slug: "acme" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { business_name: "Acme Co" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))  // no existing access
      .mockReturnValueOnce(makeChain({ data: null, error: null })); // insert access
    mockAdminAuthAdmin.generateLink.mockResolvedValueOnce({
      data: null,
      error: { message: "rate limited" },
    });

    const result = await sendPortalSignInLinkAction("c1", null);
    expect(result).toEqual({ error: "rate limited" });
  });

  it("returns error when Resend send fails", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom
      .mockReturnValueOnce(makeChain({ data: { tenant_id: "t1", role: "admin" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { email: "c@example.com", name: "Bob" }, error: null }));
    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: { slug: "acme" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { business_name: "Acme Co" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))  // no existing access
      .mockReturnValueOnce(makeChain({ data: null, error: null }))  // insert access
      .mockReturnValueOnce(makeChain({ data: null, error: null })); // email_log
    mockAdminAuthAdmin.generateLink.mockResolvedValueOnce({
      data: { properties: { action_link: "https://supabase.co/magic" } },
      error: null,
    });
    mockEmailsSend.mockResolvedValueOnce({
      data: null,
      error: { message: "Resend error" },
    });

    const result = await sendPortalSignInLinkAction("c1", null);
    expect(result).toEqual({ error: "Resend error" });
  });
});

// ── revokePortalAccessAction ───────────────────────────────────────────────

describe("revokePortalAccessAction", () => {
  it("returns Unauthorized when no user", async () => {
    const result = await revokePortalAccessAction("c1");
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns error when no portal access found", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "t1", role: "admin" }, error: null })
    );
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));

    const result = await revokePortalAccessAction("c1");
    expect(result).toEqual({ error: "No portal access found." });
  });

  it("revokes access when client has signed up: deletes profile, access record, and auth user", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "t1", role: "admin" }, error: null })
    );
    const accessChain = makeChain({ data: { user_id: "portal-user-1" }, error: null });
    const deleteProfileChain = makeChain({ data: null, error: null });
    const deleteAccessChain = makeChain({ data: null, error: null });
    mockAdminFrom
      .mockReturnValueOnce(accessChain)
      .mockReturnValueOnce(deleteProfileChain)
      .mockReturnValueOnce(deleteAccessChain);
    mockAdminAuthAdmin.deleteUser.mockResolvedValueOnce({ error: null });

    const result = await revokePortalAccessAction("c1");
    expect(result).toEqual({ success: true });
    expect(deleteProfileChain.delete).toHaveBeenCalled();
    expect(deleteAccessChain.delete).toHaveBeenCalled();
    expect(mockAdminAuthAdmin.deleteUser).toHaveBeenCalledWith("portal-user-1");
    expect(revalidatePath).toHaveBeenCalledWith("/clients/c1");
  });

  it("revokes access when client was invited but never signed up (user_id null)", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "t1", role: "admin" }, error: null })
    );
    const accessChain = makeChain({ data: { user_id: null }, error: null });
    const deleteAccessChain = makeChain({ data: null, error: null });
    mockAdminFrom
      .mockReturnValueOnce(accessChain)
      .mockReturnValueOnce(deleteAccessChain);

    const result = await revokePortalAccessAction("c1");
    expect(result).toEqual({ success: true });
    // No profile delete or auth user delete when user_id is null
    expect(mockAdminAuthAdmin.deleteUser).not.toHaveBeenCalled();
    expect(deleteAccessChain.delete).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/clients/c1");
  });
});
