/**
 * Auth setup — verifies that the admin storageState written by global-setup.ts
 * actually grants access to the admin dashboard.
 *
 * The state file is written by global-setup.ts (which uses the Supabase REST API
 * directly, not a browser login), so this spec just sanity-checks it.
 */
import { test as setup, expect } from "@playwright/test";
import path from "path";

export const ADMIN_STATE = path.join(__dirname, ".auth/admin.json");

setup("admin storageState grants dashboard access", async ({ page }) => {
  await page.context().addInitScript(() => {}); // no-op — storageState loaded by project config

  // Load the saved state
  await page.goto("/dashboard");
  // If the session is valid, middleware allows through; otherwise redirects to /auth/login
  await expect(page).not.toHaveURL(/auth\/login/, { timeout: 10_000 });
});
