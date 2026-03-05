import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  mockSupabaseClient,
  mockSupabaseFrom,
  makeChain,
  resetSupabaseMocks,
} from "@/lib/supabase/__mocks__";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { logTaskEvent } from "@/app/actions/audit";

beforeEach(() => {
  resetSupabaseMocks();
  (createClient as Mock).mockResolvedValue(mockSupabaseClient);
});

describe("logTaskEvent", () => {
  it("inserts an audit row with the correct fields", async () => {
    const chain = makeChain({ data: null, error: null });
    mockSupabaseFrom.mockReturnValueOnce(chain);

    await logTaskEvent({
      tenantId: "tenant-1",
      taskId: "task-1",
      actorId: "user-1",
      actorRole: "admin",
      eventType: "comment_added",
      metadata: { snippet: "hello" },
    });

    expect(mockSupabaseFrom).toHaveBeenCalledWith("task_audit_log");
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        task_id: "task-1",
        actor_id: "user-1",
        actor_role: "admin",
        event_type: "comment_added",
        metadata: { snippet: "hello" },
      })
    );
  });

  it("silently ignores Supabase errors (never throws)", async () => {
    const chain = makeChain({ data: null, error: { message: "db error" } });
    mockSupabaseFrom.mockReturnValueOnce(chain);

    // Should not throw
    await expect(
      logTaskEvent({
        tenantId: "tenant-1",
        taskId: "task-1",
        actorId: "user-1",
        actorRole: "client",
        eventType: "attachment_added",
        newValue: "file.pdf",
      })
    ).resolves.toBeUndefined();
  });

  it("passes old_value and new_value when provided", async () => {
    const chain = makeChain({ data: null, error: null });
    mockSupabaseFrom.mockReturnValueOnce(chain);

    await logTaskEvent({
      tenantId: "t",
      taskId: "tk",
      actorId: "u",
      actorRole: "admin",
      eventType: "status_changed",
      oldValue: "backlog",
      newValue: "in_progress",
    });

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        old_value: "backlog",
        new_value: "in_progress",
      })
    );
  });
});
