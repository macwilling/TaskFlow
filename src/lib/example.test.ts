import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSupabaseClient, resetSupabaseMocks } from "@/lib/supabase/__mocks__";

// Example: mock the server client so unit tests never hit real Supabase
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockSupabaseClient,
}));

beforeEach(() => {
  resetSupabaseMocks();
});

describe("example unit test", () => {
  it("passes", () => {
    expect(true).toBe(true);
  });

  it("Supabase mock returns null user by default", async () => {
    const { data } = await mockSupabaseClient.auth.getUser();
    expect(data.user).toBeNull();
  });

  it("Supabase mock can be configured per-test", async () => {
    const fakeUser = { id: "user-1", email: "test@example.com" };
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: fakeUser },
      error: null,
    });

    const { data } = await mockSupabaseClient.auth.getUser();
    expect(data.user).toEqual(fakeUser);
  });
});
