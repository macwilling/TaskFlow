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
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import {
  inviteClientToPortalAction,
  sendPortalSignInLinkAction,
  revokePortalAccessAction,
  finalizeInviteAction,
} from "@/app/actions/portal";

const adminUser = { id: "admin-1", app_metadata: { role: "admin" } };
const portalUser = {
  id: "portal-1",
  email: "client@example.com",
  app_metadata: { role: "client", tenant_slug: "acme" },
  user_metadata: { tenant_id: "t1", client_id: "c1" },
};

beforeEach(() => {
  resetSupabaseMocks();
  (createClient as Mock).mockResolvedValue(mockSupabaseClient);
  (createAdminClient as Mock).mockReturnValue(mockAdminClient);
});

// ── inviteClientToPortalAction ─────────────────────────────────────────────

describe("inviteClientToPortalAction", () => {
  const makeFormData = (email: string) => {
    const fd = new FormData();
    fd.append("email", email);
    return fd;
  };

  it("returns Unauthorized when no user", async () => {
    const result = await inviteClientToPortalAction("c1", null, makeFormData("a@b.com"));
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns error when email is empty", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    const result = await inviteClientToPortalAction("c1", null, makeFormData(""));
    expect(result).toEqual({ error: "Email is required." });
  });

  it("returns Unauthorized when profile role is not admin", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "t1", role: "client" }, error: null })
    );
    const result = await inviteClientToPortalAction("c1", null, makeFormData("x@y.com"));
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns error when client not found", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom
      .mockReturnValueOnce(makeChain({ data: { tenant_id: "t1", role: "admin" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null })); // client not found

    const result = await inviteClientToPortalAction("c1", null, makeFormData("x@y.com"));
    expect(result).toEqual({ error: "Client not found." });
  });

  it("returns error from admin invite call", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom
      .mockReturnValueOnce(makeChain({ data: { tenant_id: "t1", role: "admin" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { id: "c1" }, error: null }));
    mockAdminAuthAdmin.inviteUserByEmail.mockResolvedValueOnce({
      data: null,
      error: { message: "already invited" },
    });

    const result = await inviteClientToPortalAction("c1", null, makeFormData("x@y.com"));
    expect(result).toEqual({ error: "already invited" });
  });

  it("invites client successfully", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom
      .mockReturnValueOnce(makeChain({ data: { tenant_id: "t1", role: "admin" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { id: "c1" }, error: null }));
    mockAdminAuthAdmin.inviteUserByEmail.mockResolvedValueOnce({
      data: {},
      error: null,
    });

    const result = await inviteClientToPortalAction("c1", null, makeFormData("client@example.com"));
    expect(result).toEqual({ success: true });
    expect(mockAdminAuthAdmin.inviteUserByEmail).toHaveBeenCalledWith(
      "client@example.com",
      expect.objectContaining({
        data: expect.objectContaining({ role: "client", tenant_id: "t1", client_id: "c1" }),
      })
    );
  });
});

// ── sendPortalSignInLinkAction ─────────────────────────────────────────────

describe("sendPortalSignInLinkAction", () => {
  it("returns Unauthorized when no user", async () => {
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
      .mockReturnValueOnce(makeChain({ data: { email: null }, error: null }));

    const result = await sendPortalSignInLinkAction("c1", null);
    expect(result).toEqual({ error: "Client email not found." });
  });

  it("returns error when no portal access", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom
      .mockReturnValueOnce(makeChain({ data: { tenant_id: "t1", role: "admin" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { email: "c@example.com" }, error: null }));
    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: null, error: null })); // no portal access

    const result = await sendPortalSignInLinkAction("c1", null);
    expect(result).toEqual({ error: "Client does not have portal access." });
  });

  it("sends magic link successfully", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom
      .mockReturnValueOnce(makeChain({ data: { tenant_id: "t1", role: "admin" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { email: "c@example.com" }, error: null }));
    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: { user_id: "u1" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: { slug: "acme" }, error: null }));
    mockSupabaseClient.auth.signInWithOtp.mockResolvedValueOnce({ error: null });

    const result = await sendPortalSignInLinkAction("c1", null);
    expect(result).toEqual({ success: true });
    expect(mockSupabaseClient.auth.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "c@example.com" })
    );
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

  it("revokes access: deletes profile, access record, and auth user", async () => {
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
});

// ── finalizeInviteAction ───────────────────────────────────────────────────

describe("finalizeInviteAction", () => {
  it("returns error when not authenticated", async () => {
    const result = await finalizeInviteAction();
    expect(result).toEqual({ error: "Not authenticated." });
  });

  it("returns slug for existing client profile", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: portalUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { role: "client" }, error: null })
    );

    const result = await finalizeInviteAction();
    expect(result).toEqual({ slug: "acme" });
  });

  it("returns error when tenant_id or client_id missing in metadata", async () => {
    const userNoMeta = { id: "u1", app_metadata: {}, user_metadata: {} };
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: userNoMeta },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));

    const result = await finalizeInviteAction();
    expect(result).toEqual({ error: "Invalid invite." });
  });

  it("creates profile + portal access for new invite user", async () => {
    const inviteUser = {
      id: "new-user",
      email: "new@example.com",
      app_metadata: {},
      user_metadata: { tenant_id: "t1", client_id: "c1" },
    };
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: inviteUser },
      error: null,
    });
    // no existing profile
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));
    // admin: tenant lookup
    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: { slug: "acme" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null })) // profiles insert
      .mockReturnValueOnce(makeChain({ data: null, error: null })); // portal_access insert
    mockAdminAuthAdmin.updateUserById.mockResolvedValueOnce({ error: null });

    const result = await finalizeInviteAction();
    expect(result).toEqual({ slug: "acme" });
    expect(mockAdminAuthAdmin.updateUserById).toHaveBeenCalledWith(
      "new-user",
      expect.objectContaining({
        app_metadata: expect.objectContaining({ role: "client", tenant_slug: "acme" }),
      })
    );
  });
});
