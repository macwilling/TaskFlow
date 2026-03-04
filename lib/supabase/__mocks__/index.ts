import { vi } from "vitest";

/**
 * Shared Supabase mock client for unit tests.
 *
 * Usage in a test file:
 *   vi.mock("@/lib/supabase/server", () => ({ createClient: () => mockSupabaseClient }));
 *   vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mockSupabaseClient }));
 *
 * You can then configure return values per-test:
 *   mockSupabaseFrom.mockReturnValueOnce({
 *     select: vi.fn().mockReturnThis(),
 *     eq: vi.fn().mockResolvedValue({ data: [...], error: null }),
 *   });
 */

export const mockSupabaseFrom = vi.fn();
export const mockSupabaseAuth = {
  getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
};

export const mockSupabaseClient = {
  from: mockSupabaseFrom,
  auth: mockSupabaseAuth,
  rpc: vi.fn(),
};

/** Resets all mock state. Call this in beforeEach. */
export function resetSupabaseMocks() {
  mockSupabaseFrom.mockReset();
  mockSupabaseAuth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  mockSupabaseAuth.signInWithPassword.mockReset();
  mockSupabaseAuth.signOut.mockReset();
  (mockSupabaseClient.rpc as ReturnType<typeof vi.fn>).mockReset();
}
