import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mockGetUser = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(search: Record<string, string> = {}) {
  const params = new URLSearchParams(search).toString();
  const url = `http://localhost:3000/api/time-entries${params ? `?${params}` : ""}`;
  return new NextRequest(url);
}

const adminUser = { id: "user-1", app_metadata: { role: "admin" } };
const clientUser = { id: "user-2", app_metadata: { role: "client" } };

// All-day entries (no start_time)
const TIME_ENTRIES = [
  {
    id: "te-1",
    description: "API work",
    entry_date: "2026-03-01",
    start_time: null,
    duration_hours: "2.5",
    billable: true,
    billed: false,
    hourly_rate: "150.00",
    client_id: "client-1",
    task_id: "task-1",
    clients: { name: "Acme", color: "#0969da" },
    tasks: { title: "Fix bug" },
  },
  {
    id: "te-2",
    description: "Meeting",
    entry_date: "2026-03-02",
    start_time: null,
    duration_hours: "1",
    billable: true,
    billed: false,
    hourly_rate: "150.00",
    client_id: "client-1",
    task_id: null,
    clients: { name: "Acme", color: "#0969da" },
    tasks: null,
  },
];

// Timed entry (has start_time)
const TIMED_ENTRY = {
  id: "te-3",
  description: "Design review",
  entry_date: "2026-03-03",
  start_time: "14:00:00",
  duration_hours: "1.5",
  billable: true,
  billed: false,
  hourly_rate: "150.00",
  client_id: "client-1",
  task_id: null,
  clients: { name: "Acme", color: "#0969da" },
  tasks: null,
};

/** Builds a mock Supabase query chain that resolves with the given rows. */
function buildQueryChain(rows: unknown[], error: { message: string } | null = null) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
  };
  // The terminal call is implicit — the chain itself is the Promise
  Object.defineProperty(chain, "then", {
    value: (resolve: (v: { data: unknown; error: unknown }) => void) =>
      Promise.resolve({ data: rows, error }).then(resolve),
  });
  return chain;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/time-entries", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const { GET } = await import("./route");
    const res = await GET(makeRequest({ start: "2026-03-01", end: "2026-03-31" }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/unauthorized/i);
  });

  it("returns 401 when user is not an admin", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: clientUser } });

    const { GET } = await import("./route");
    const res = await GET(makeRequest({ start: "2026-03-01", end: "2026-03-31" }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/unauthorized/i);
  });

  it("returns 400 when start and end are missing in calendar mode", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: adminUser } });

    const { GET } = await import("./route");
    const res = await GET(makeRequest({})); // no start/end and no invoice-mode params
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/start and end required/i);
  });

  it("returns allDay FullCalendar events when entries have no start_time", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: adminUser } });
    mockFrom.mockReturnValueOnce(buildQueryChain(TIME_ENTRIES));

    const { GET } = await import("./route");
    const res = await GET(makeRequest({ start: "2026-03-01", end: "2026-03-31" }));
    expect(res.status).toBe(200);
    const events = await res.json();

    expect(Array.isArray(events)).toBe(true);
    expect(events).toHaveLength(2);

    const first = events[0];
    expect(first).toMatchObject({
      id: "te-1",
      start: "2026-03-01",
      allDay: true,
      backgroundColor: "#0969da",
    });
    expect(first).not.toHaveProperty("end");
    expect(first.title).toContain("Acme");
    expect(first.title).toContain("2.50h");
    expect(first.extendedProps).toMatchObject({
      durationHours: 2.5,
      billable: true,
      billed: false,
      startTime: null,
    });
  });

  it("returns timed FullCalendar events when entries have start_time", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: adminUser } });
    mockFrom.mockReturnValueOnce(buildQueryChain([TIMED_ENTRY]));

    const { GET } = await import("./route");
    const res = await GET(makeRequest({ start: "2026-03-01", end: "2026-03-31" }));
    expect(res.status).toBe(200);
    const events = await res.json();

    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(ev).toMatchObject({
      id: "te-3",
      start: "2026-03-03T14:00",
      allDay: false,
    });
    // End should be start + 1.5h = 15:30
    expect(ev.end).toBe("2026-03-03T15:30");
    expect(ev.extendedProps.startTime).toBe("14:00");
    expect(ev.extendedProps.durationHours).toBe(1.5);
  });

  it("returns raw entry objects in invoice builder mode (client param, no dates)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: adminUser } });
    mockFrom.mockReturnValueOnce(buildQueryChain(TIME_ENTRIES));

    const { GET } = await import("./route");
    const res = await GET(makeRequest({ client: "client-1", billed: "false", billable: "true" }));
    expect(res.status).toBe(200);
    const entries = await res.json();

    expect(Array.isArray(entries)).toBe(true);
    expect(entries).toHaveLength(2);

    const first = entries[0];
    // Invoice mode returns raw shape — no FullCalendar-specific keys
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("entry_date");
    expect(first).toHaveProperty("start_time");
    expect(first).toHaveProperty("duration_hours");
    expect(first.duration_hours).toBe(2.5); // cast to Number
    expect(first).not.toHaveProperty("title");
    expect(first).not.toHaveProperty("allDay");
  });

  it("returns 500 when the database query fails", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: adminUser } });
    mockFrom.mockReturnValueOnce(buildQueryChain([], { message: "DB connection lost" }));

    const { GET } = await import("./route");
    const res = await GET(makeRequest({ start: "2026-03-01", end: "2026-03-31" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/DB connection lost/);
  });

  it("returns empty array when no entries exist in date range", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: adminUser } });
    mockFrom.mockReturnValueOnce(buildQueryChain([]));

    const { GET } = await import("./route");
    const res = await GET(makeRequest({ start: "2026-03-01", end: "2026-03-31" }));
    expect(res.status).toBe(200);
    const events = await res.json();
    expect(events).toEqual([]);
  });
});
