/**
 * Auth setup — verifies that the admin storageState written by global-setup.ts
 * actually grants access to the admin dashboard.
 *
 * The state file is written by global-setup.ts (which uses the Supabase REST API
 * directly, not a browser login), so this spec just sanity-checks it.
 *
 * Skips gracefully when no credentials are available (e.g. local dev without .env.local).
 */
import { test as setup, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const ADMIN_STATE = path.join(__dirname, ".auth/admin.json");

setup("admin storageState grants dashboard access", async ({ page }, testInfo) => {
  // Skip if global-setup wrote empty cookies (no Supabase credentials configured)
  if (fs.existsSync(ADMIN_STATE)) {
    const state = JSON.parse(fs.readFileSync(ADMIN_STATE, "utf-8"));
    if (!Array.isArray(state.cookies) || state.cookies.length === 0) {
      testInfo.skip(true, "No admin session available — Supabase credentials not configured.");
      return;
    }
  }

  await page.goto("/dashboard");
  // If the session is valid, middleware allows through; otherwise redirects to /auth/login
  await expect(page).not.toHaveURL(/auth\/login/, { timeout: 10_000 });
});
