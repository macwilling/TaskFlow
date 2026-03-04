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
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createClientAction,
  updateClientAction,
  archiveClientAction,
} from "@/app/actions/clients";

const adminUser = {
  id: "user-1",
  email: "admin@example.com",
  app_metadata: { role: "admin" },
};
const clientUser = {
  id: "user-2",
  email: "client@example.com",
  app_metadata: { role: "client" },
};

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    name: "Acme Corp",
    client_key: "ACME",
    company: "Acme Inc",
    email: "acme@example.com",
    phone: "",
    default_rate: "100",
    payment_terms: "30",
    currency: "USD",
    color: "#0969da",
    notes: "",
    billing_line1: "",
    billing_line2: "",
    billing_city: "",
    billing_state: "",
    billing_postal_code: "",
    billing_country: "",
  };
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) {
    fd.append(k, v);
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetSupabaseMocks();
  (createClient as Mock).mockResolvedValue(mockSupabaseClient);
  (createAdminClient as Mock).mockReturnValue(mockAdminClient);
});

// ── createClientAction ────────────────────────────────────────────────────

describe("createClientAction", () => {
  it("returns Unauthorized when no user", async () => {
    const result = await createClientAction(null, makeFormData());
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns Unauthorized when role is client", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: clientUser },
      error: null,
    });
    const result = await createClientAction(null, makeFormData());
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns error when name is empty", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "tenant-1" }, error: null })
    );
    const result = await createClientAction(null, makeFormData({ name: "" }));
    expect(result).toEqual({ error: "Client name is required." });
  });

  it("returns error for invalid client key", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "tenant-1" }, error: null })
    );
    const result = await createClientAction(
      null,
      makeFormData({ client_key: "invalid key!" })
    );
    expect(result).toEqual({
      error: "Client key must be 2–10 uppercase letters or digits (e.g. AC, ACME).",
    });
  });

  it("returns DB error on insert failure", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom
      .mockReturnValueOnce(makeChain({ data: { tenant_id: "tenant-1" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: { message: "duplicate key" } }));

    const result = await createClientAction(null, makeFormData());
    expect(result).toEqual({ error: "duplicate key" });
  });

  it("creates client and calls revalidatePath + redirect on success", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    const profileChain = makeChain({ data: { tenant_id: "tenant-1" }, error: null });
    const clientsChain = makeChain({ data: { id: "client-new" }, error: null });
    mockSupabaseFrom
      .mockReturnValueOnce(profileChain)
      .mockReturnValueOnce(clientsChain);

    await createClientAction(null, makeFormData());

    expect(revalidatePath).toHaveBeenCalledWith("/clients");
    expect(redirect).toHaveBeenCalledWith("/clients/client-new");
  });

  // Issue #30: tenant isolation — tenant_id comes from profile, not formData
  it("uses tenant_id from profile (not from user input)", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    const profileChain = makeChain({ data: { tenant_id: "tenant-from-profile" }, error: null });
    const clientsChain = makeChain({ data: { id: "client-new" }, error: null });
    mockSupabaseFrom
      .mockReturnValueOnce(profileChain)
      .mockReturnValueOnce(clientsChain);

    await createClientAction(null, makeFormData());

    // The insert call should have received tenant_id from profile
    expect(clientsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: "tenant-from-profile" })
    );
  });
});

// ── updateClientAction ────────────────────────────────────────────────────

describe("updateClientAction", () => {
  it("returns Unauthorized when no user", async () => {
    const result = await updateClientAction("client-1", null, makeFormData());
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns error when name is empty", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    const result = await updateClientAction("client-1", null, makeFormData({ name: "  " }));
    expect(result).toEqual({ error: "Client name is required." });
  });

  it("returns DB error on update failure", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    // existing client fetch → update
    mockSupabaseFrom
      .mockReturnValueOnce(makeChain({ data: { email: "old@example.com" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: { message: "update failed" } }));

    const result = await updateClientAction("client-1", null, makeFormData());
    expect(result).toEqual({ error: "update failed" });
  });

  it("updates client and revalidates + redirects on success", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom
      .mockReturnValueOnce(makeChain({ data: { email: "same@example.com" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }));

    const fd = makeFormData({ email: "same@example.com" });
    await updateClientAction("client-1", null, fd);

    expect(revalidatePath).toHaveBeenCalledWith("/clients/client-1");
    expect(revalidatePath).toHaveBeenCalledWith("/clients");
    expect(redirect).toHaveBeenCalledWith("/clients/client-1");
  });

  it("syncs auth email when email changed and portal access exists", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom
      .mockReturnValueOnce(makeChain({ data: { email: "old@example.com" }, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }));
    mockAdminFrom.mockReturnValueOnce(
      makeChain({ data: { user_id: "portal-user-id" }, error: null })
    );
    mockAdminAuthAdmin.updateUserById.mockResolvedValue({ error: null });

    const fd = makeFormData({ email: "new@example.com" });
    await updateClientAction("client-1", null, fd);

    expect(mockAdminAuthAdmin.updateUserById).toHaveBeenCalledWith(
      "portal-user-id",
      expect.objectContaining({ email: "new@example.com", email_confirm: true })
    );
  });
});

// ── archiveClientAction ───────────────────────────────────────────────────

describe("archiveClientAction", () => {
  it("does nothing when unauthorized", async () => {
    await archiveClientAction("client-1", true);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("archives client and revalidates on success", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));

    await archiveClientAction("client-1", true);

    expect(revalidatePath).toHaveBeenCalledWith("/clients/client-1");
    expect(revalidatePath).toHaveBeenCalledWith("/clients");
  });
});
