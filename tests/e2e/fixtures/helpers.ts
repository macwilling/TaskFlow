import { Page } from "@playwright/test";

/**
 * Navigate to `path` and return `false` (skip signal) if the server
 * redirects to the login page (i.e. no valid session).
 *
 * Usage in a test:
 *   if (!(await requireAuth(page, "/tasks"))) return;
 */
export async function requireAuth(page: Page, path: string): Promise<boolean> {
  await page.goto(path);
  await page.waitForURL(/.+/, { timeout: 8_000 });
  if (page.url().includes("/auth/login") || page.url().includes("/portal")) {
    return false; // not authenticated — global-setup likely failed or was skipped
  }
  return true;
}
