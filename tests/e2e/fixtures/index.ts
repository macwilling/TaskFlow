/**
 * Shared Playwright fixtures, paths, and helpers.
 *
 * Usage in specs:
 *   import { test, expect, ADMIN_STATE, CLIENT_STATE, mockResend } from "./fixtures";
 */

import { test as base, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

export { expect };

export const ADMIN_STATE = path.join(__dirname, ".auth/admin.json");
export const CLIENT_STATE = path.join(__dirname, ".auth/client.json");

const SEED_FILE = path.join(__dirname, "seed.json");

export interface SeedData {
  tenantId: string;
  tenantSlug: string;
  adminUserId: string;
  adminEmail: string;
  adminPassword: string;
  clientUserId: string;
  clientEmail: string;
  clientId: string;
  taskId: string;
}

function loadSeed(): SeedData | null {
  if (!fs.existsSync(SEED_FILE)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(SEED_FILE, "utf-8"));
    if (!raw.tenantId) return null;
    return raw as SeedData;
  } catch {
    return null;
  }
}

/** Mock the Resend email endpoint — prevents real emails during tests. */
export async function mockResend(page: Page) {
  await page.route("**/api/email/**", (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ id: "mocked" }) })
  );
}

/** Mock the R2 upload endpoint — returns a fixture URL. */
export async function mockUpload(page: Page) {
  await page.route("**/api/upload**", (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ url: "https://files.example.com/test.png", key: "test.png" }),
    })
  );
}

interface SeedFixture {
  seed: SeedData;
}

/**
 * Extended test with a `seed` fixture.
 * Skips the test when seed data is unavailable (i.e. global-setup couldn't create
 * the dynamic portal test data — typically because Supabase credentials are absent).
 */
export const test = base.extend<SeedFixture>({
  seed: async ({}, use, testInfo) => {
    const data = loadSeed();
    if (!data) {
      testInfo.skip(true, "Portal seed data not available — skipping.");
      return;
    }
    await use(data);
  },
});
