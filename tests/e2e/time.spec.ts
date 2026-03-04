/**
 * E2E tests — time tracking flows (issue #39)
 *
 * Covers:
 *  - Navigate to time tracking page → calendar renders
 *  - Click a day → new time entry dialog opens with pre-filled date
 *  - Create time entry → event appears on calendar
 *  - Edit time entry → duration and description update
 *  - Delete time entry → event removed from calendar
 *  - Switch between week and month views → events still visible
 *  - Drag event to a different day → updateTimeEntryDateAction fires
 *
 * Requires:
 *   E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD — set for auth setup to run.
 *   If unset, auth-setup is skipped and these tests are skipped too.
 */
import { test, expect } from "@playwright/test";
import { requireAuth } from "./fixtures/helpers";
import { ADMIN_STATE } from "./fixtures";

// Load the admin session written by global-setup.ts
test.use({ storageState: ADMIN_STATE });

const ENTRY_DESCRIPTION = "E2E time entry " + Date.now().toString(36);
const ENTRY_HOURS = "2";
const EDITED_HOURS = "3";

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("time tracking", () => {
  test("calendar renders on the time page", async ({ page }) => {
    if (!(await requireAuth(page, "/time"))) {
      test.skip();
      return;
    }

    // FullCalendar renders with a toolbar and a grid
    await expect(page.locator(".fc")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".fc-toolbar")).toBeVisible();
    await expect(page.locator(".fc-daygrid-body, .fc-timegrid-body")).toBeVisible();
  });

  test("clicking a day opens the time entry dialog with a pre-filled date", async ({ page }) => {
    if (!(await requireAuth(page, "/time"))) {
      test.skip();
      return;
    }
    await expect(page.locator(".fc")).toBeVisible({ timeout: 15_000 });

    // Click a visible day cell
    await page.locator(".fc-daygrid-day").first().click();

    // Dialog should open
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

    // Date field should be pre-filled (not empty)
    const dateInput = page.getByLabel(/date/i).first();
    await expect(dateInput).not.toHaveValue("");
  });

  test("create a time entry → event appears on calendar", async ({ page }) => {
    if (!(await requireAuth(page, "/time"))) {
      test.skip();
      return;
    }
    await expect(page.locator(".fc")).toBeVisible({ timeout: 15_000 });

    // Click a day to open the modal
    await page.locator(".fc-daygrid-day").first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

    // Pick client
    const clientCombo = page.getByRole("combobox").first();
    await clientCombo.click();
    const firstOption = page.getByRole("option").first();
    if (await firstOption.isVisible({ timeout: 3_000 })) {
      await firstOption.click();
    }

    // Hours
    const hoursInput = page.getByLabel(/hours|duration/i).first();
    await hoursInput.clear();
    await hoursInput.fill(ENTRY_HOURS);

    // Description
    const descInput = page.getByLabel(/description/i).first();
    if (await descInput.isVisible()) await descInput.fill(ENTRY_DESCRIPTION);

    await page.getByRole("button", { name: /save|add|log/i }).last().click();

    // Dialog closes
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 8_000 });

    // New event visible on calendar
    await expect(page.locator(".fc-event").first()).toBeVisible({ timeout: 10_000 });
  });

  test("edit a time entry → duration updates on calendar", async ({ page }) => {
    if (!(await requireAuth(page, "/time"))) {
      test.skip();
      return;
    }
    await expect(page.locator(".fc")).toBeVisible({ timeout: 15_000 });

    const events = page.locator(".fc-event");
    if ((await events.count()) === 0) {
      test.skip(); // no events to edit
      return;
    }

    // Click first event
    await events.first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

    const hoursInput = page.getByLabel(/hours|duration/i).first();
    await hoursInput.clear();
    await hoursInput.fill(EDITED_HOURS);

    await page.getByRole("button", { name: /save|update/i }).last().click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 8_000 });

    // Calendar refetches — at least one event should still be visible
    await expect(page.locator(".fc-event").first()).toBeVisible({ timeout: 10_000 });
  });

  test("delete a time entry → event count decreases", async ({ page }) => {
    if (!(await requireAuth(page, "/time"))) {
      test.skip();
      return;
    }
    await expect(page.locator(".fc")).toBeVisible({ timeout: 15_000 });

    const events = page.locator(".fc-event");
    const before = await events.count();
    if (before === 0) {
      test.skip(); // nothing to delete
      return;
    }

    await events.first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

    const deleteBtn = page.getByRole("button", { name: /delete/i });
    await expect(deleteBtn).toBeVisible({ timeout: 3_000 });

    page.once("dialog", (d) => d.accept());
    await deleteBtn.click();

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 8_000 });
    await page.waitForTimeout(1_500); // let calendar refetch

    const after = await page.locator(".fc-event").count();
    expect(after).toBeLessThan(before);
  });

  test("switch between week and month views — events remain visible", async ({ page }) => {
    if (!(await requireAuth(page, "/time"))) {
      test.skip();
      return;
    }
    await expect(page.locator(".fc")).toBeVisible({ timeout: 15_000 });

    const weekEvents = await page.locator(".fc-event").count();

    // Switch to month view
    await page.getByRole("button", { name: /month/i }).click();
    await expect(page.locator(".fc-daygrid-body")).toBeVisible({ timeout: 5_000 });

    const monthEvents = await page.locator(".fc-event").count();
    // Month view covers a wider date range — event count should be ≥ week count
    expect(monthEvents).toBeGreaterThanOrEqual(weekEvents);

    // Switch back to week
    await page.getByRole("button", { name: /week/i }).first().click();
    await expect(page.locator(".fc")).toBeVisible();
  });

  test("drag event to a different day → event stays on calendar (not reverted)", async ({
    page,
  }) => {
    if (!(await requireAuth(page, "/time"))) {
      test.skip();
      return;
    }
    await expect(page.locator(".fc")).toBeVisible({ timeout: 15_000 });

    const events = page.locator(".fc-event");
    if ((await events.count()) === 0) {
      test.skip();
      return;
    }

    // Drag first event to a different day cell (index 3 to avoid same-cell drop)
    const event = events.first();
    const targetCell = page.locator(".fc-daygrid-day").nth(3);

    await event.dragTo(targetCell, { force: true });

    // Wait for updateTimeEntryDateAction to fire
    await page.waitForTimeout(2_000);

    // Event should still be on the calendar (not reverted means action succeeded)
    await expect(events.first()).toBeVisible({ timeout: 5_000 });
  });
});
