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
import { redirect } from "next/navigation";
import {
  createTaskAction,
  updateTaskMetaAction,
  closeTaskAction,
  deleteTaskAction,
  updateTaskStatusAction,
} from "@/app/actions/tasks";

const adminUser = {
  id: "user-1",
  app_metadata: { role: "admin" },
};

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    title: "Build a thing",
    client_id: "client-1",
    due_date: "2026-04-01",
    estimated_hours: "8",
    priority: "medium",
  };
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) {
    fd.append(k, v);
  }
  return fd;
}

beforeEach(() => {
  resetSupabaseMocks();
  (createClient as Mock).mockResolvedValue(mockSupabaseClient);
});

// ── createTaskAction ──────────────────────────────────────────────────────

describe("createTaskAction", () => {
  it("returns Unauthorized when no user", async () => {
    const result = await createTaskAction(null, makeFormData());
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns error when title is empty", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "t1" }, error: null })
    );
    const result = await createTaskAction(null, makeFormData({ title: "" }));
    expect(result).toEqual({ error: "Title is required." });
  });

  it("returns error when client_id is empty", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "t1" }, error: null })
    );
    const result = await createTaskAction(null, makeFormData({ client_id: "" }));
    expect(result).toEqual({ error: "Client is required." });
  });

  it("returns rpc error if task number generation fails", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    // profile
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "t1" }, error: null })
    );
    // default status lookup
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { id: "status-1" }, error: null })
    );
    mockSupabaseClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "rpc error" },
    });
    const result = await createTaskAction(null, makeFormData());
    expect(result).toEqual({ error: "rpc error" });
  });

  it("creates task and redirects to slug on success", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    // profile
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "t1" }, error: null })
    );
    // default status lookup
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { id: "status-1" }, error: null })
    );
    mockSupabaseClient.rpc.mockResolvedValueOnce({ data: 1, error: null });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({
        data: {
          id: "task-1",
          task_number: 1,
          clients: { client_key: "ACME" },
        },
        error: null,
      })
    );

    await createTaskAction(null, makeFormData());

    expect(revalidatePath).toHaveBeenCalledWith("/app/tasks");
    expect(redirect).toHaveBeenCalledWith("/app/tasks/ACME-1");
  });

  // Issue #30: tenant_id must come from profile
  it("uses tenant_id from profile (not from form input)", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    const profileChain = makeChain({ data: { tenant_id: "profile-tenant" }, error: null });
    mockSupabaseFrom.mockReturnValueOnce(profileChain);
    // default status lookup
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { id: "status-1" }, error: null })
    );
    mockSupabaseClient.rpc.mockResolvedValueOnce({ data: 42, error: null });
    const tasksChain = makeChain({
      data: { id: "t", task_number: 42, clients: { client_key: "X" } },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(tasksChain);

    await createTaskAction(null, makeFormData());

    expect(tasksChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: "profile-tenant", status_id: "status-1" })
    );
  });
});

// ── updateTaskMetaAction ──────────────────────────────────────────────────

describe("updateTaskMetaAction", () => {
  it("returns Unauthorized when no user", async () => {
    const result = await updateTaskMetaAction("task-1", null, makeFormData());
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns error when title is empty", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    const result = await updateTaskMetaAction("task-1", null, makeFormData({ title: "" }));
    expect(result).toEqual({ error: "Title is required." });
  });

  it("updates task and revalidates on success", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    // update chain
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));
    // getTaskSlug chain
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({
        data: { task_number: 3, clients: { client_key: "AC" } },
        error: null,
      })
    );

    const result = await updateTaskMetaAction("task-1", null, makeFormData());
    expect(result).toEqual({});
    expect(revalidatePath).toHaveBeenCalledWith("/app/tasks/AC-3");
    expect(revalidatePath).toHaveBeenCalledWith("/app/tasks");
  });
});

// ── closeTaskAction ───────────────────────────────────────────────────────

describe("closeTaskAction", () => {
  it("returns Unauthorized when no user", async () => {
    const result = await closeTaskAction("task-1", "done");
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns error when closed status not found", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    // profile lookup
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "t1" }, error: null })
    );
    // closed status lookup — not found
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: null, error: { message: "not found" } })
    );
    const result = await closeTaskAction("task-1", "done");
    expect(result).toEqual({ error: "Closed status not configured." });
  });

  it("returns DB error on update failure", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    // profile
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "t1" }, error: null })
    );
    // closed status
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { id: "closed-status-id" }, error: null })
    );
    // update tasks — error
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: null, error: { message: "db error" } })
    );
    const result = await closeTaskAction("task-1", "done");
    expect(result).toEqual({ error: "db error" });
  });

  it("closes task using is_closed status and revalidates on success", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    // profile
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { tenant_id: "t1" }, error: null })
    );
    // closed status lookup
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { id: "closed-status-id" }, error: null })
    );
    // update tasks
    const updateChain = makeChain({ data: null, error: null });
    mockSupabaseFrom.mockReturnValueOnce(updateChain);
    // getTaskSlug
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({
        data: { task_number: 1, clients: { client_key: "AC" } },
        error: null,
      })
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({}));

    const result = await closeTaskAction("task-1", "fixed it");
    expect(result).toEqual({});
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status_id: "closed-status-id", closed_at: expect.any(String) })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/app/tasks/AC-1");
    expect(revalidatePath).toHaveBeenCalledWith("/app/tasks");
  });
});

// ── updateTaskStatusAction ────────────────────────────────────────────────

describe("updateTaskStatusAction", () => {
  it("returns Unauthorized when no user", async () => {
    const result = await updateTaskStatusAction("task-1", "status-uuid-1");
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("sets closed_at when target status is_closed", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    // status lookup
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { is_closed: true }, error: null })
    );
    const updateChain = makeChain({ data: null, error: null });
    mockSupabaseFrom.mockReturnValueOnce(updateChain);
    // getTaskSlug
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { task_number: 1, clients: { client_key: "X" } }, error: null })
    );

    await updateTaskStatusAction("task-1", "closed-status-id");

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status_id: "closed-status-id", closed_at: expect.any(String) })
    );
  });

  it("clears closed_at when target status is not closed", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    // status lookup — not closed
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { is_closed: false }, error: null })
    );
    const updateChain = makeChain({ data: null, error: null });
    mockSupabaseFrom.mockReturnValueOnce(updateChain);
    // getTaskSlug
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: { task_number: 1, clients: { client_key: "X" } }, error: null })
    );

    await updateTaskStatusAction("task-1", "open-status-id");

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status_id: "open-status-id", closed_at: null })
    );
  });
});

// ── deleteTaskAction ──────────────────────────────────────────────────────

describe("deleteTaskAction", () => {
  it("returns Unauthorized when no user", async () => {
    const result = await deleteTaskAction("task-1");
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns DB error on delete failure", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: null, error: { message: "delete failed" } })
    );
    const result = await deleteTaskAction("task-1");
    expect(result).toEqual({ error: "delete failed" });
  });

  it("deletes task, revalidates, and redirects to /tasks", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: adminUser },
      error: null,
    });
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));

    await deleteTaskAction("task-1");

    expect(revalidatePath).toHaveBeenCalledWith("/app/tasks");
    expect(redirect).toHaveBeenCalledWith("/app/tasks");
  });
});
