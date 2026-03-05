import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mockEmailsSend = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockGetUser = vi.hoisted(() => vi.fn());

vi.mock("resend", () => ({
  // Use a class so `new Resend(...)` works in Vitest v4
  Resend: class {
    emails = { send: mockEmailsSend };
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: mockGetUser } }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

const clientUser = { id: "user-1", app_metadata: { role: "client" } };

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/email/comment", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const COMMENT = {
  id: "comment-1",
  body: "Please update the status.",
  tenant_id: "tenant-1",
  tasks: { id: "task-1", title: "Fix login bug" },
};

const SETTINGS_WITH_EMAIL = {
  email: "admin@acme.com",
  business_name: "Acme Corp",
};

function mockCommentQuery(comment: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: comment,
      error: comment ? null : { message: "not found" },
    }),
  };
}

function mockSettingsQuery(settings: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: settings, error: null }),
  };
}

function mockEmailLogInsert() {
  return { insert: vi.fn().mockResolvedValue({ data: {}, error: null }) };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/email/comment", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: authenticated client user (comment route requires any authenticated user)
    mockGetUser.mockResolvedValue({ data: { user: clientUser } });
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ commentId: "comment-1" }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/unauthorized/i);
  });

  it("returns 400 when commentId is missing", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/missing commentId/i);
  });

  it("returns 404 when comment is not found", async () => {
    mockFrom.mockReturnValueOnce(mockCommentQuery(null));

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ commentId: "nonexistent" }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/not found/i);
  });

  it("returns 404 when comment has no associated task", async () => {
    const commentNoTask = { ...COMMENT, tasks: null };
    mockFrom.mockReturnValueOnce(mockCommentQuery(commentNoTask));

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ commentId: "comment-1" }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/task not found/i);
  });

  it("returns {skipped:true} when tenant settings has no admin email", async () => {
    mockFrom
      .mockReturnValueOnce(mockCommentQuery(COMMENT))
      .mockReturnValueOnce(mockSettingsQuery({ email: null, business_name: "Acme" }));

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ commentId: "comment-1" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.skipped).toBe(true);
    expect(mockEmailsSend).not.toHaveBeenCalled();
  });

  it("returns {sent:true} and logs the email on success", async () => {
    mockFrom
      .mockReturnValueOnce(mockCommentQuery(COMMENT))
      .mockReturnValueOnce(mockSettingsQuery(SETTINGS_WITH_EMAIL))
      .mockReturnValueOnce(mockEmailLogInsert());

    mockEmailsSend.mockResolvedValueOnce({ data: { id: "resend-456" }, error: null });

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ commentId: "comment-1" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(true);

    expect(mockEmailsSend).toHaveBeenCalledOnce();
    const [emailArgs] = mockEmailsSend.mock.calls[0];
    expect(emailArgs.to).toBe("admin@acme.com");
    expect(emailArgs.subject).toContain("Fix login bug");
    expect(emailArgs.html).toContain("Please update the status.");

    const logInsert = mockFrom.mock.results[2].value.insert;
    expect(logInsert).toHaveBeenCalledOnce();
    const [logRow] = logInsert.mock.calls[0];
    expect(logRow.status).toBe("sent");
    expect(logRow.resend_id).toBe("resend-456");
    expect(logRow.tenant_id).toBe("tenant-1");
  });

  it("returns 500 and logs failure when Resend send fails", async () => {
    mockFrom
      .mockReturnValueOnce(mockCommentQuery(COMMENT))
      .mockReturnValueOnce(mockSettingsQuery(SETTINGS_WITH_EMAIL))
      .mockReturnValueOnce(mockEmailLogInsert());

    mockEmailsSend.mockResolvedValueOnce({
      data: null,
      error: { message: "Quota exceeded" },
    });

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ commentId: "comment-1" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/quota exceeded/i);

    const logInsert = mockFrom.mock.results[2].value.insert;
    const [logRow] = logInsert.mock.calls[0];
    expect(logRow.status).toBe("failed");
    expect(logRow.error_message).toMatch(/quota exceeded/i);
  });

  it("escapes HTML in comment body to prevent XSS in email", async () => {
    const xssComment = { ...COMMENT, body: "<img src=x onerror=alert(1)>" };
    mockFrom
      .mockReturnValueOnce(mockCommentQuery(xssComment))
      .mockReturnValueOnce(mockSettingsQuery(SETTINGS_WITH_EMAIL))
      .mockReturnValueOnce(mockEmailLogInsert());
    mockEmailsSend.mockResolvedValueOnce({ data: { id: "r-1" }, error: null });

    const { POST } = await import("./route");
    await POST(makeRequest({ commentId: "comment-1" }));

    const [emailArgs] = mockEmailsSend.mock.calls[0];
    expect(emailArgs.html).not.toContain("<img");
    expect(emailArgs.html).toContain("&lt;img");
  });
});
