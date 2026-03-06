import { vi } from "vitest";

/**
 * Shared Supabase mock client for unit tests.
 *
 * Usage in a test file:
 *   vi.mock("@/lib/supabase/server", () => ({ createClient: () => mockSupabaseClient }));
 *   vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mockAdminClient }));
 *
 * Build per-call chains with makeChain():
 *   mockSupabaseFrom.mockReturnValueOnce(makeChain({ data: { id: "1" }, error: null }));
 */

export type MockResult = { data: unknown; error: unknown };

/**
 * Creates a chainable Supabase query mock.
 * All builder methods (select, eq, insert, …) return the same object so chains
 * work naturally.  The object is also thenable so `await builder` resolves to
 * `result` (covers patterns like `await supabase.from("x").update({}).eq(…)`).
 * Terminal methods `single()` and `maybeSingle()` also resolve to `result`.
 */
export function makeChain(result: MockResult = { data: null, error: null }) {
  const resolved = Promise.resolve(result);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj: Record<string, any> = {};

  const returnSelf = () => obj;
  for (const m of [
    "select", "insert", "update", "delete", "upsert",
    "eq", "neq", "in", "not", "gte", "lte", "contains",
    "limit", "order", "range",
  ]) {
    obj[m] = vi.fn(returnSelf);
  }
  obj.single = vi.fn(() => resolved);
  obj.maybeSingle = vi.fn(() => resolved);
  // Make the builder itself awaitable
  obj.then = resolved.then.bind(resolved);
  obj.catch = resolved.catch.bind(resolved);
  return obj;
}

// ── Regular (server) client ────────────────────────────────────────────────

export const mockSupabaseFrom = vi.fn();
export const mockSupabaseAuth = {
  getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  signInWithOtp: vi.fn(),
  exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
};

export const mockSupabaseClient = {
  from: mockSupabaseFrom,
  auth: mockSupabaseAuth,
  rpc: vi.fn(),
};

// ── Admin client ───────────────────────────────────────────────────────────

export const mockAdminFrom = vi.fn();
export const mockAdminAuthAdmin = {
  createUser: vi.fn(),
  updateUserById: vi.fn(),
  deleteUser: vi.fn(),
  inviteUserByEmail: vi.fn(),
  generateLink: vi.fn(),
};

export const mockAdminClient = {
  from: mockAdminFrom,
  auth: { admin: mockAdminAuthAdmin },
  rpc: vi.fn(),
};

// ── Reset helpers ──────────────────────────────────────────────────────────

/** Resets all mock state. Call this in beforeEach. */
export function resetSupabaseMocks() {
  mockSupabaseFrom.mockReset();
  mockAdminFrom.mockReset();
  mockSupabaseAuth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  mockSupabaseAuth.signInWithPassword.mockReset();
  mockSupabaseAuth.signOut.mockReset();
  mockSupabaseAuth.signInWithOtp.mockReset();
  mockSupabaseAuth.exchangeCodeForSession.mockResolvedValue({ error: null });
  (mockSupabaseClient.rpc as ReturnType<typeof vi.fn>).mockReset();
  mockAdminAuthAdmin.createUser.mockReset();
  mockAdminAuthAdmin.updateUserById.mockReset();
  mockAdminAuthAdmin.deleteUser.mockReset();
  mockAdminAuthAdmin.inviteUserByEmail.mockReset();
  mockAdminAuthAdmin.generateLink.mockReset();
  (mockAdminClient.rpc as ReturnType<typeof vi.fn>).mockReset();
}
