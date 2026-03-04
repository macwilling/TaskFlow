/**
 * E2E tests for client portal flows — issue #38
 *
 * Covers:
 *  - Client logs in via magic link → lands on portal dashboard
 *  - Client views task list → sees only their tasks
 *  - Client opens a task → reads description (read-only view)
 *  - Client adds a portal comment → appears in comment list
 *  - Client edits their own comment → updated in place
 *  - Client deletes their own comment → removed from list
 *  - Client cannot see edit/delete on another user's comment
 *  - Client cannot access admin routes → redirected
 *
 * All describe blocks that need a client session apply:
 *   seedTest.use({ storageState: CLIENT_STATE })
 *
 * Tests skip automatically when seed data is absent (no Supabase credentials).
 */

import { test as seedTest, expect, mockResend, CLIENT_STATE } from "./fixtures";
import { test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// ── Supabase admin helper (seed/cleanup mid-test data) ────────────────────────

function adminSupa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ── Magic link login (unauthenticated start) ──────────────────────────────────

seedTest.describe("portal magic link login", () => {
  seedTest(
    "following admin-generated magic link lands on portal dashboard",
    async ({ page, seed }) => {
      const admin = adminSupa();
      const appUrl =
        process.env.PLAYWRIGHT_BASE_URL ??
        process.env.NEXT_PUBLIC_APP_URL ??
        "http://localhost:3000";

      const { data, error } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: seed.clientEmail,
        options: { redirectTo: `${appUrl}/auth/callback` },
      });

      if (error || !data?.properties?.action_link) {
        test.skip();
        return;
      }

      await page.goto(data.properties.action_link);
      await expect(page).toHaveURL(new RegExp(`/portal/${seed.tenantSlug}`), {
        timeout: 15_000,
      });
    }
  );
});

// ── Portal task list ──────────────────────────────────────────────────────────

seedTest.describe("portal task list", () => {
  seedTest.use({ storageState: CLIENT_STATE });

  seedTest("client sees their assigned task on the dashboard", async ({ page, seed }) => {
    await page.goto(`/portal/${seed.tenantSlug}`);
    await expect(page.getByText("E2E Test Task")).toBeVisible({ timeout: 10_000 });
  });

  seedTest("client does NOT see tasks belonging to other clients", async ({ page, seed }) => {
    const admin = adminSupa();

    const { data: otherClient } = await admin
      .from("clients")
      .insert({ tenant_id: seed.tenantId, name: "Other Client", client_key: "OTH", color: "#ccc" })
      .select("id")
      .single();

    if (!otherClient) return;

    const { data: otherTask } = await admin
      .from("tasks")
      .insert({
        tenant_id: seed.tenantId,
        client_id: otherClient.id,
        title: "HIDDEN Other Client Task",
        status: "open",
        priority: "low",
        task_number: 9999,
      })
      .select("id")
      .single();

    try {
      await page.goto(`/portal/${seed.tenantSlug}`);
      await expect(page.getByText("E2E Test Task")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("HIDDEN Other Client Task")).not.toBeVisible();
    } finally {
      if (otherTask) await admin.from("tasks").delete().eq("id", otherTask.id);
      await admin.from("clients").delete().eq("id", otherClient.id);
    }
  });
});

// ── Task detail ───────────────────────────────────────────────────────────────

seedTest.describe("portal task detail", () => {
  seedTest.use({ storageState: CLIENT_STATE });

  seedTest("client opens task and sees title + status badges", async ({ page, seed }) => {
    await page.goto(`/portal/${seed.tenantSlug}/tasks/${seed.taskId}`);
    await expect(page.getByRole("heading", { name: "E2E Test Task" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/open/i).first()).toBeVisible();
    // Should NOT show an editable title input (read-only)
    await expect(page.getByRole("textbox", { name: /title/i })).not.toBeVisible();
  });

  seedTest("back link navigates to portal dashboard", async ({ page, seed }) => {
    await page.goto(`/portal/${seed.tenantSlug}/tasks/${seed.taskId}`);
    await page.getByRole("link", { name: /back to tasks/i }).click();
    await expect(page).toHaveURL(new RegExp(`/portal/${seed.tenantSlug}$`), {
      timeout: 8_000,
    });
  });
});

// ── Comments ──────────────────────────────────────────────────────────────────

seedTest.describe("portal comments", () => {
  seedTest.use({ storageState: CLIENT_STATE });

  seedTest("client can add a comment that appears in the list", async ({ page, seed }) => {
    await mockResend(page);
    await page.goto(`/portal/${seed.tenantSlug}/tasks/${seed.taskId}`);

    const body = `Portal comment ${Date.now()}`;
    await page.getByPlaceholder(/leave a comment/i).fill(body);
    await page.getByRole("button", { name: /^comment$/i }).click();

    await expect(page.getByText(body)).toBeVisible({ timeout: 10_000 });

    // Cleanup
    const admin = adminSupa();
    await admin.from("comments").delete().eq("body", body).eq("tenant_id", seed.tenantId);
  });

  seedTest("client can edit their own comment", async ({ page, seed }) => {
    const admin = adminSupa();
    const original = `Original comment ${Date.now()}`;
    const { data: comment } = await admin
      .from("comments")
      .insert({
        tenant_id: seed.tenantId,
        task_id: seed.taskId,
        author_id: seed.clientUserId,
        author_role: "client",
        body: original,
      })
      .select("id")
      .single();

    if (!comment) return;

    try {
      await page.goto(`/portal/${seed.tenantSlug}/tasks/${seed.taskId}`);
      await expect(page.getByText(original)).toBeVisible({ timeout: 10_000 });

      // Click the pencil edit button on this comment's row
      const row = page.locator("div").filter({ hasText: original }).last();
      await row.getByRole("button", { name: /edit comment/i }).click();

      const updated = `Updated comment ${Date.now()}`;
      await page.getByLabel(/edit comment/i).fill(updated);
      await page.getByRole("button", { name: /^save$/i }).click();

      await expect(page.getByText(updated)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(original)).not.toBeVisible();
    } finally {
      await admin.from("comments").delete().eq("id", comment.id);
    }
  });

  seedTest("client can delete their own comment", async ({ page, seed }) => {
    const admin = adminSupa();
    const body = `Comment to delete ${Date.now()}`;
    const { data: comment } = await admin
      .from("comments")
      .insert({
        tenant_id: seed.tenantId,
        task_id: seed.taskId,
        author_id: seed.clientUserId,
        author_role: "client",
        body,
      })
      .select("id")
      .single();

    if (!comment) return;

    await page.goto(`/portal/${seed.tenantSlug}/tasks/${seed.taskId}`);
    await expect(page.getByText(body)).toBeVisible({ timeout: 10_000 });

    page.once("dialog", (dialog) => dialog.accept());

    const row = page.locator("div").filter({ hasText: body }).last();
    await row.getByRole("button", { name: /delete comment/i }).click();

    await expect(page.getByText(body)).not.toBeVisible({ timeout: 10_000 });
  });

  seedTest(
    "client cannot see edit/delete buttons on another user's comment",
    async ({ page, seed }) => {
      const admin = adminSupa();
      const adminBody = `Admin comment ${Date.now()}`;
      const { data: comment } = await admin
        .from("comments")
        .insert({
          tenant_id: seed.tenantId,
          task_id: seed.taskId,
          author_id: seed.adminUserId,
          author_role: "admin",
          body: adminBody,
        })
        .select("id")
        .single();

      if (!comment) return;

      try {
        await page.goto(`/portal/${seed.tenantSlug}/tasks/${seed.taskId}`);
        await expect(page.getByText(adminBody)).toBeVisible({ timeout: 10_000 });

        const row = page.locator("div").filter({ hasText: adminBody }).last();
        await expect(row.getByRole("button", { name: /edit comment/i })).not.toBeVisible();
        await expect(row.getByRole("button", { name: /delete comment/i })).not.toBeVisible();
      } finally {
        await admin.from("comments").delete().eq("id", comment.id);
      }
    }
  );
});

// ── Client cannot access admin routes ─────────────────────────────────────────

seedTest.describe("admin route guard", () => {
  seedTest.use({ storageState: CLIENT_STATE });

  seedTest("client accessing / is redirected to their portal", async ({ page, seed }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/portal\//, { timeout: 10_000 });
  });

  seedTest("client accessing /dashboard is redirected away from admin", async ({ page, seed }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/portal\/|\/auth\//, { timeout: 10_000 });
  });
});
