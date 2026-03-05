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

const adminUser = { id: "user-1", app_metadata: { role: "admin" } };

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/email/task-closed", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const TENANT = { id: "tenant-1", name: "Acme", slug: "acme" };
const CLIENT_WITH_EMAIL = { name: "Bob", email: "bob@client.com", tenants: TENANT };
const TASK = {
  id: "task-1",
  title: "Fix login bug",
  resolution_notes: "Resolved in v2.1",
  clients: CLIENT_WITH_EMAIL,
};

function mockTaskQuery(task: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: task, error: task ? null : { message: "not found" } }),
  };
}

function mockEmailLogInsert() {
  return { insert: vi.fn().mockResolvedValue({ data: {}, error: null }) };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/email/task-closed", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    // Default: authenticated admin user
    mockGetUser.mockResolvedValue({ data: { user: adminUser } });
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ taskId: "task-1" }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/unauthorized/i);
  });

  it("returns 401 when user is not an admin", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u2", app_metadata: { role: "client" } } } });
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ taskId: "task-1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when taskId is missing", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/missing taskId/i);
  });

  it("returns 404 when task is not found", async () => {
    mockFrom.mockReturnValueOnce(mockTaskQuery(null));

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ taskId: "nonexistent" }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/not found/i);
  });

  it("returns {skipped:true} when client has no email", async () => {
    const taskNoEmail = {
      ...TASK,
      clients: { name: "Bob", email: null, tenants: TENANT },
    };
    mockFrom.mockReturnValueOnce(mockTaskQuery(taskNoEmail));

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ taskId: "task-1" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.skipped).toBe(true);
    expect(mockEmailsSend).not.toHaveBeenCalled();
  });

  it("returns {sent:true} and logs the email on success", async () => {
    mockFrom
      .mockReturnValueOnce(mockTaskQuery(TASK))
      .mockReturnValueOnce(mockEmailLogInsert());

    mockEmailsSend.mockResolvedValueOnce({ data: { id: "resend-123" }, error: null });

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ taskId: "task-1" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(true);

    expect(mockEmailsSend).toHaveBeenCalledOnce();
    const [emailArgs] = mockEmailsSend.mock.calls[0];
    expect(emailArgs.to).toBe("bob@client.com");
    expect(emailArgs.subject).toContain("Fix login bug");

    // Email log insert called
    const logInsert = mockFrom.mock.results[1].value.insert;
    expect(logInsert).toHaveBeenCalledOnce();
    const [logRow] = logInsert.mock.calls[0];
    expect(logRow.status).toBe("sent");
    expect(logRow.resend_id).toBe("resend-123");
  });

  it("returns 500 and logs failure when Resend send fails", async () => {
    mockFrom
      .mockReturnValueOnce(mockTaskQuery(TASK))
      .mockReturnValueOnce(mockEmailLogInsert());

    mockEmailsSend.mockResolvedValueOnce({
      data: null,
      error: { message: "Rate limit exceeded" },
    });

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ taskId: "task-1" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/rate limit/i);

    // Email log insert still called with status=failed
    const logInsert = mockFrom.mock.results[1].value.insert;
    const [logRow] = logInsert.mock.calls[0];
    expect(logRow.status).toBe("failed");
    expect(logRow.error_message).toMatch(/rate limit/i);
  });

  it("escapes HTML in task title and resolution notes", async () => {
    const xssTask = {
      ...TASK,
      title: "<script>alert(1)</script>",
      resolution_notes: "<b>bold</b>",
    };
    mockFrom
      .mockReturnValueOnce(mockTaskQuery(xssTask))
      .mockReturnValueOnce(mockEmailLogInsert());
    mockEmailsSend.mockResolvedValueOnce({ data: { id: "r-1" }, error: null });

    const { POST } = await import("./route");
    await POST(makeRequest({ taskId: "task-1" }));

    const [emailArgs] = mockEmailsSend.mock.calls[0];
    expect(emailArgs.html).not.toContain("<script>");
    expect(emailArgs.html).toContain("&lt;script&gt;");
  });
});
