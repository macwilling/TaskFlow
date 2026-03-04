import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  mockSupabaseClient,
  mockSupabaseFrom,
  makeChain,
  resetSupabaseMocks,
} from "@/lib/supabase/__mocks__";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  createTimeEntryAction,
  updateTimeEntryAction,
  updateTimeEntryDateAction,
  deleteTimeEntryAction,
} from "@/app/actions/time";

const adminUser = { id: "user-1", app_metadata: { role: "admin" } };
const clientUser = { id: "user-2", app_metadata: { role: "client" } };

const baseInput = {
  client_id: "client-1",
  task_id: null,
  description: "Development work",
  entry_date: "2026-03-04",
  duration_hours: 2,
  billable: true,
  hourly_rate: 100,
};

beforeEach(() => {
  resetSupabaseMocks();
  (createClient as Mock).mockResolvedValue(mockSupabaseClient);
});

// ── createTimeEntryAction ─────────────────────────────────────────────────

describe("createTimeEntryAction", () => {
  it("returns Unauthorized when no user", async () => {
    const result = await createTimeEntryAction(baseInput);
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns Unauthorized for client role", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: clientUser },
      error: null,
    });
    const result = await createTimeEntryAction(baseInput);
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns error when profile not found", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));
    const result = await createTimeEntryAction(baseInput);
    expect(result).toEqual({ error: "Profile not found." });
  });

  it("returns DB error on insert failure", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "t1" }, error: null })
    );
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: null, error: { message: "insert failed" } })
    );
    const result = await createTimeEntryAction(baseInput);
    expect(result).toEqual({ error: "insert failed" });
  });

  it("creates time entry and revalidates /time on success", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "t1" }, error: null })
    );
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { id: "entry-1" }, error: null })
    );

    const result = await createTimeEntryAction(baseInput);
    expect(result).toEqual({ id: "entry-1" });
    expect(revalidatePath).toHaveBeenCalledWith("/time");
  });

  it("also revalidates task path when task_id provided", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "t1" }, error: null })
    );
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { id: "entry-2" }, error: null })
    );
    // getTaskSlug chain
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { task_number: 5, clients: { client_key: "AC" } }, error: null })
    );

    await createTimeEntryAction({ ...baseInput, task_id: "task-1" });

    expect(revalidatePath).toHaveBeenCalledWith("/tasks/AC-5");
  });

  // Issue #30: tenant_id comes from profile
  it("inserts entry with tenant_id from profile", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    const profileChain = makeChain({ data: { tenant_id: "profile-tenant" }, error: null });
    const insertChain = makeChain({ data: { id: "entry-3" }, error: null });
    mockSupabaseFrom
      .mockReturnValueOnce(profileChain)
      .mockReturnValueOnce(insertChain);

    await createTimeEntryAction(baseInput);

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: "profile-tenant" })
    );
  });
});

// ── updateTimeEntryAction ─────────────────────────────────────────────────

describe("updateTimeEntryAction", () => {
  it("returns Unauthorized when no user", async () => {
    const result = await updateTimeEntryAction("entry-1", baseInput);
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns DB error on update failure", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: null, error: { message: "update failed" } })
    );
    const result = await updateTimeEntryAction("entry-1", baseInput);
    expect(result).toEqual({ error: "update failed" });
  });

  it("updates entry and revalidates /time on success", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));

    const result = await updateTimeEntryAction("entry-1", baseInput);
    expect(result).toEqual({});
    expect(revalidatePath).toHaveBeenCalledWith("/time");
  });
});

// ── updateTimeEntryDateAction ─────────────────────────────────────────────

describe("updateTimeEntryDateAction", () => {
  it("returns Unauthorized when no user", async () => {
    const result = await updateTimeEntryDateAction("entry-1", "2026-03-10");
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("updates date and revalidates on success", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));

    const result = await updateTimeEntryDateAction("entry-1", "2026-03-10");
    expect(result).toEqual({});
    expect(revalidatePath).toHaveBeenCalledWith("/time");
  });

  it("returns DB error on update failure", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: null, error: { message: "date update failed" } })
    );
    const result = await updateTimeEntryDateAction("entry-1", "2026-03-10");
    expect(result).toEqual({ error: "date update failed" });
  });
});

// ── deleteTimeEntryAction ─────────────────────────────────────────────────

describe("deleteTimeEntryAction", () => {
  it("returns Unauthorized when no user", async () => {
    const result = await deleteTimeEntryAction("entry-1");
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("deletes entry and revalidates /time", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));

    const result = await deleteTimeEntryAction("entry-1");
    expect(result).toEqual({});
    expect(revalidatePath).toHaveBeenCalledWith("/time");
  });

  it("also revalidates task when taskId provided", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { task_number: 2, clients: { client_key: "BC" } }, error: null })
    );

    await deleteTimeEntryAction("entry-1", "task-2");
    expect(revalidatePath).toHaveBeenCalledWith("/tasks/BC-2");
  });
});
