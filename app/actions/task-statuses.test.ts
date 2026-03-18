import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  mockSupabaseClient,
  mockSupabaseFrom,
  makeChain,
  resetSupabaseMocks,
} from "@/lib/supabase/__mocks__";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  getTaskStatusesAction,
  createTaskStatusAction,
  updateTaskStatusAction,
  reorderTaskStatusesAction,
  setDefaultTaskStatusAction,
  deleteTaskStatusAction,
} from "@/app/actions/task-statuses";

const adminUser = { id: "user-1", app_metadata: { role: "admin" } };

function makeAdminCtxMocks() {
  mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
    data: { user: adminUser },
    error: null,
  });
  mockSupabaseFrom.mockReturnValueOnce(
    makeChain({ data: { tenant_id: "tenant-1" }, error: null })
  );
}

beforeEach(() => {
  resetSupabaseMocks();
  (createClient as Mock).mockResolvedValue(mockSupabaseClient);
});

// ── getTaskStatusesAction ─────────────────────────────────────────────────────

describe("getTaskStatusesAction", () => {
  it("returns empty array when unauthorized", async () => {
    const result = await getTaskStatusesAction();
    expect(result).toEqual([]);
  });

  it("returns ordered statuses for the tenant", async () => {
    makeAdminCtxMocks();
    const statuses = [
      { id: "s1", name: "Backlog", color: "#6b7280", position: 0, is_default: true, is_closed: false },
      { id: "s2", name: "Closed", color: "#22c55e", position: 1, is_default: false, is_closed: true },
    ];
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: statuses, error: null }));

    const result = await getTaskStatusesAction();
    expect(result).toEqual(statuses);
  });
});

// ── createTaskStatusAction ────────────────────────────────────────────────────

describe("createTaskStatusAction", () => {
  it("returns Unauthorized when no user", async () => {
    const result = await createTaskStatusAction("QA", "#3b82f6");
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns error for empty name", async () => {
    makeAdminCtxMocks();
    const result = await createTaskStatusAction("  ", "#3b82f6");
    expect(result).toEqual({ error: "Name is required." });
  });

  it("returns error for invalid color format", async () => {
    makeAdminCtxMocks();
    const result = await createTaskStatusAction("QA", "blue");
    expect(result).toEqual({ error: "Invalid color format." });
  });

  it("creates status at max_position + 1 and returns id", async () => {
    makeAdminCtxMocks();
    // max position lookup
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: { position: 3 }, error: null }));
    // insert
    const insertChain = makeChain({ data: { id: "new-status-id" }, error: null });
    mockSupabaseFrom.mockReturnValueOnce(insertChain);

    const result = await createTaskStatusAction("QA Review", "#8b5cf6");
    expect(result).toEqual({ id: "new-status-id" });
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: "QA Review", color: "#8b5cf6", position: 4 })
    );
    expect(revalidatePath).toHaveBeenCalled();
  });
});

// ── updateTaskStatusAction ────────────────────────────────────────────────────

describe("updateTaskStatusAction", () => {
  it("returns Unauthorized when no user", async () => {
    const result = await updateTaskStatusAction("s1", { name: "Renamed" });
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns error for empty name", async () => {
    makeAdminCtxMocks();
    const result = await updateTaskStatusAction("s1", { name: "  " });
    expect(result).toEqual({ error: "Name is required." });
  });

  it("returns error for invalid color", async () => {
    makeAdminCtxMocks();
    const result = await updateTaskStatusAction("s1", { color: "notacolor" });
    expect(result).toEqual({ error: "Invalid color format." });
  });

  it("updates name and color, revalidates on success", async () => {
    makeAdminCtxMocks();
    const updateChain = makeChain({ data: null, error: null });
    mockSupabaseFrom.mockReturnValueOnce(updateChain);

    const result = await updateTaskStatusAction("s1", { name: "Renamed", color: "#ef4444" });
    expect(result).toEqual({});
    expect(updateChain.update).toHaveBeenCalledWith({ name: "Renamed", color: "#ef4444" });
    expect(revalidatePath).toHaveBeenCalled();
  });
});

// ── reorderTaskStatusesAction ─────────────────────────────────────────────────

describe("reorderTaskStatusesAction", () => {
  it("returns Unauthorized when no user", async () => {
    const result = await reorderTaskStatusesAction(["s1", "s2"]);
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns error when IDs don't all belong to tenant", async () => {
    makeAdminCtxMocks();
    // ownership check returns only 1 of 2
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: [{ id: "s1" }], error: null }));

    const result = await reorderTaskStatusesAction(["s1", "s2"]);
    expect(result).toEqual({ error: "Invalid status IDs." });
  });

  it("updates positions for all IDs on success", async () => {
    makeAdminCtxMocks();
    // ownership check
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: [{ id: "s1" }, { id: "s2" }], error: null }));
    // two update calls (one per status)
    mockSupabaseFrom.mockReturnValue(makeChain({ data: null, error: null }));

    const result = await reorderTaskStatusesAction(["s1", "s2"]);
    expect(result).toEqual({});
    expect(revalidatePath).toHaveBeenCalled();
  });
});

// ── setDefaultTaskStatusAction ────────────────────────────────────────────────

describe("setDefaultTaskStatusAction", () => {
  it("returns Unauthorized when no user", async () => {
    const result = await setDefaultTaskStatusAction("s1");
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns error when trying to set closed status as default", async () => {
    makeAdminCtxMocks();
    // status lookup returns is_closed = true
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: { is_closed: true }, error: null }));

    const result = await setDefaultTaskStatusAction("closed-id");
    expect(result).toEqual({ error: "The closed status cannot be set as the default." });
  });

  it("clears old default and sets new one", async () => {
    makeAdminCtxMocks();
    // status lookup
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: { is_closed: false }, error: null }));
    // clear old default
    mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));
    // set new default
    const setChain = makeChain({ data: null, error: null });
    mockSupabaseFrom.mockReturnValueOnce(setChain);

    const result = await setDefaultTaskStatusAction("s1");
    expect(result).toEqual({});
    expect(setChain.update).toHaveBeenCalledWith({ is_default: true });
    expect(revalidatePath).toHaveBeenCalled();
  });
});

// ── deleteTaskStatusAction ────────────────────────────────────────────────────

describe("deleteTaskStatusAction", () => {
  it("returns Unauthorized when no user", async () => {
    const result = await deleteTaskStatusAction("s1", "s2");
    expect(result).toEqual({ error: "Unauthorized." });
  });

  it("returns error when status is_closed", async () => {
    makeAdminCtxMocks();
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({
        data: [
          { id: "s1", is_closed: true, is_default: false },
          { id: "s2", is_closed: false, is_default: false },
        ],
        error: null,
      })
    );

    const result = await deleteTaskStatusAction("s1", "s2");
    expect(result).toEqual({ error: "The closed status cannot be deleted." });
  });

  it("returns error when status is_default", async () => {
    makeAdminCtxMocks();
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({
        data: [
          { id: "s1", is_closed: false, is_default: true },
          { id: "s2", is_closed: false, is_default: false },
        ],
        error: null,
      })
    );

    const result = await deleteTaskStatusAction("s1", "s2");
    expect(result).toEqual({ error: "Cannot delete the default status. Set another status as default first." });
  });

  it("moves tasks then deletes status on success", async () => {
    makeAdminCtxMocks();
    // both IDs found, s1 is deletable
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({
        data: [
          { id: "s1", is_closed: false, is_default: false },
          { id: "s2", is_closed: false, is_default: false },
        ],
        error: null,
      })
    );
    // move tasks
    const moveChain = makeChain({ data: null, error: null });
    mockSupabaseFrom.mockReturnValueOnce(moveChain);
    // delete status
    const deleteChain = makeChain({ data: null, error: null });
    mockSupabaseFrom.mockReturnValueOnce(deleteChain);

    const result = await deleteTaskStatusAction("s1", "s2");
    expect(result).toEqual({});
    // tasks were updated before status deleted
    expect(moveChain.update).toHaveBeenCalledWith({ status_id: "s2" });
    expect(deleteChain.delete).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("returns error if task move fails", async () => {
    makeAdminCtxMocks();
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({
        data: [
          { id: "s1", is_closed: false, is_default: false },
          { id: "s2", is_closed: false, is_default: false },
        ],
        error: null,
      })
    );
    // move tasks fails
    mockSupabaseFrom.mockReturnValueOnce(
      makeChain({ data: null, error: { message: "move failed" } })
    );

    const result = await deleteTaskStatusAction("s1", "s2");
    expect(result).toEqual({ error: "move failed" });
  });
});
