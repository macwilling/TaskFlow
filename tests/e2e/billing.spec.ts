/**
 * E2E tests for billing and invoice management (issue #37).
 *
 * Relies on:
 *  - A running dev server (npm run dev)
 *  - A real Supabase test project with at least one client seeded for the admin tenant
 *  - Admin credentials/storageState written by global-setup.ts
 *
 * Session state is cached by global-setup.ts so we only auth once.
 */
import { test, expect, Page } from "@playwright/test";
import path from "path";

const ADMIN_STATE = path.join(__dirname, "fixtures/.auth/admin.json");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Navigate to /invoices/new, select the first client, and add one line item.
 * The invoice builder starts with zero line items — "Add item" must be clicked first.
 */
async function buildMinimalInvoice(
  page: Page,
  opts: {
    dueDate?: string; // ISO yyyy-mm-dd
    unitPrice?: number;
    quantity?: number;
  } = {}
) {
  const { dueDate, unitPrice = 100, quantity = 2 } = opts;

  await page.goto("/invoices/new");
  await page.waitForLoadState("networkidle");

  // Select the first available client from the dropdown
  await page.locator('[id="client_id"]').click();
  const firstOption = page.locator('[role="option"]').first();
  await firstOption.waitFor({ state: "visible" });
  await firstOption.click();

  // Set issue date if blank
  const issueDateInput = page.locator('[id="issue_date"]');
  const existingIssue = await issueDateInput.inputValue();
  if (!existingIssue) {
    await issueDateInput.fill(new Date().toISOString().split("T")[0]);
  }

  if (dueDate) {
    await page.locator('[id="due_date"]').fill(dueDate);
  }

  // Add the first line item (the builder starts with an empty list)
  await page.getByRole("button", { name: /add item/i }).click();

  // Wait for the row to appear
  const descInput = page.locator('input[placeholder="Description"]').first();
  await descInput.waitFor({ state: "visible" });
  await descInput.fill("Consulting services");

  // Quantity and unit_price inputs have pre-filled value "0" (no placeholder).
  // Use the row's second and third number inputs.
  const row = page.locator("tbody tr").first();
  const numberInputs = row.locator('input[type="number"]');
  await numberInputs.nth(0).fill(String(quantity));   // qty
  await numberInputs.nth(1).fill(String(unitPrice));  // unit_price
  // Blur to trigger amount recalculation
  await numberInputs.nth(1).press("Tab");
}

// ─── Test suite ───────────────────────────────────────────────────────────────

test.describe("billing — invoice management", () => {
  test.use({ storageState: ADMIN_STATE });

  // ── 1. Totals computed correctly ──────────────────────────────────────────

  test("line item totals are computed correctly in the builder UI", async ({ page }) => {
    await buildMinimalInvoice(page, { unitPrice: 150, quantity: 3 });

    // Amount = 150 × 3 = $450.00 — shown as text cell in the row
    const row = page.locator("tbody tr").first();
    await expect(row).toContainText("$450.00");

    // Subtotal section (the summary panel below the line items table)
    await expect(page.getByText(/subtotal/i).first()).toBeVisible();
    // At least one $450.00 is visible (may appear in row + subtotal + total)
    await expect(page.getByText("$450.00").first()).toBeVisible();
  });

  // ── 2. Add / remove line item — subtotal updates ──────────────────────────

  test("adding and removing a line item updates the subtotal", async ({ page }) => {
    await buildMinimalInvoice(page, { unitPrice: 100, quantity: 1 });

    // Subtotal after first item: $100.00
    await expect(page.getByText("$100.00").first()).toBeVisible();

    // Add second item
    await page.getByRole("button", { name: /add item/i }).click();
    await expect(page.locator("tbody tr")).toHaveCount(2);

    const secondRow = page.locator("tbody tr").nth(1);
    await secondRow.locator('input[placeholder="Description"]').fill("Extra work");
    const secondNums = secondRow.locator('input[type="number"]');
    await secondNums.nth(0).fill("2");
    await secondNums.nth(1).fill("50");
    await secondNums.nth(1).press("Tab");

    // Subtotal: 100 + 100 = $200.00
    await expect(page.getByText("$200.00").first()).toBeVisible();

    // Remove the second row by hovering and clicking its delete button
    await secondRow.hover();
    await secondRow.locator("button[type='button']").click();

    // Subtotal returns to $100.00
    await expect(page.getByText("$100.00").first()).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(1);
  });

  // ── 3. Create invoice — redirects to detail with draft status ────────────

  test("creating an invoice redirects to the detail page with draft status", async ({ page }) => {
    await buildMinimalInvoice(page, { unitPrice: 200, quantity: 1 });

    await page.getByRole("button", { name: /save as draft/i }).click();

    // Redirects to /invoices/<uuid>
    await page.waitForURL(/\/invoices\/[0-9a-f-]{36}$/, { timeout: 15_000 });

    await expect(page.getByText(/draft/i).first()).toBeVisible();
    await expect(page.getByText(/consulting services/i).first()).toBeVisible();
  });

  // ── 4. Send invoice → status changes to "sent" ────────────────────────────

  test("sending an invoice changes its status to sent", async ({ page }) => {
    await buildMinimalInvoice(page, { unitPrice: 300, quantity: 1 });
    await page.getByRole("button", { name: /save as draft/i }).click();
    await page.waitForURL(/\/invoices\/[0-9a-f-]{36}$/, { timeout: 15_000 });

    await page.getByRole("button", { name: /^send$/i }).click();

    await expect(page.getByText(/sent/i).first()).toBeVisible({ timeout: 10_000 });
    // Confirm no "Draft" badge is visible
    await expect(page.getByText("Draft").first()).not.toBeVisible();
  });

  // ── 5. View PDF — content-type must be application/pdf ───────────────────

  test("invoice PDF endpoint returns 200 with correct content-type", async ({ page }) => {
    await buildMinimalInvoice(page, { unitPrice: 250, quantity: 1 });
    await page.getByRole("button", { name: /save as draft/i }).click();
    await page.waitForURL(/\/invoices\/[0-9a-f-]{36}$/, { timeout: 15_000 });

    const invoiceId = page.url().split("/").pop()!;
    expect(invoiceId).toMatch(/^[0-9a-f-]{36}$/);

    const response = await page.request.get(`/api/pdf/${invoiceId}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
  });

  // ── 6. Mark invoice as paid ───────────────────────────────────────────────

  test("recording full payment marks invoice as paid", async ({ page }) => {
    await buildMinimalInvoice(page, { unitPrice: 500, quantity: 1 });
    await page.getByRole("button", { name: /save as draft/i }).click();
    await page.waitForURL(/\/invoices\/[0-9a-f-]{36}$/, { timeout: 15_000 });

    // Send first
    await page.getByRole("button", { name: /^send$/i }).click();
    await expect(page.getByText(/sent/i).first()).toBeVisible({ timeout: 10_000 });

    // Record full payment
    await page.locator('[id="amount"]').fill("500");
    await page.locator('[id="payment_date"]').fill(new Date().toISOString().split("T")[0]);
    await page.getByRole("button", { name: /record payment/i }).click();

    await expect(page.getByText(/paid/i).first()).toBeVisible({ timeout: 10_000 });
  });

  // ── 7. Overdue badge ──────────────────────────────────────────────────────

  test("invoice with past due date shows overdue badge after sending", async ({ page }) => {
    await buildMinimalInvoice(page, { unitPrice: 100, quantity: 1, dueDate: "2020-01-01" });
    await page.getByRole("button", { name: /save as draft/i }).click();
    await page.waitForURL(/\/invoices\/[0-9a-f-]{36}$/, { timeout: 15_000 });

    // Send (overdue only computed for non-draft)
    await page.getByRole("button", { name: /^send$/i }).click();
    await expect(page.getByText(/overdue/i).first()).toBeVisible({ timeout: 10_000 });

    // Verify overdue badge appears on the list page too
    await page.goto("/invoices");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/overdue/i).first()).toBeVisible();
  });

  // ── 8. Invoice numbers auto-increment ────────────────────────────────────

  test("invoice number increments across two consecutive invoices", async ({ page }) => {
    // First invoice
    await buildMinimalInvoice(page, { unitPrice: 100, quantity: 1 });
    await page.getByRole("button", { name: /save as draft/i }).click();
    await page.waitForURL(/\/invoices\/[0-9a-f-]{36}$/, { timeout: 15_000 });

    const firstNumEl = page.getByText(/[A-Z]+-\d+/).first();
    const firstText = await firstNumEl.textContent() ?? "";
    const firstNum = parseInt(firstText.replace(/[^0-9]/g, ""), 10);
    expect(firstNum).toBeGreaterThan(0);

    // Second invoice
    await buildMinimalInvoice(page, { unitPrice: 100, quantity: 1 });
    await page.getByRole("button", { name: /save as draft/i }).click();
    await page.waitForURL(/\/invoices\/[0-9a-f-]{36}$/, { timeout: 15_000 });

    const secondNumEl = page.getByText(/[A-Z]+-\d+/).first();
    const secondText = await secondNumEl.textContent() ?? "";
    const secondNum = parseInt(secondText.replace(/[^0-9]/g, ""), 10);

    expect(secondNum).toBe(firstNum + 1);
  });

  // ── 9. Reports page loads without error ───────────────────────────────────

  test("reports page loads revenue and time summary without errors", async ({ page }) => {
    await page.goto("/reports");
    await page.waitForLoadState("networkidle");

    // Must not show a generic error
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
    await expect(page.getByText(/failed to load/i)).not.toBeVisible();

    // Key report sections are present
    await expect(page.getByText(/revenue/i).first()).toBeVisible();
    await expect(page.getByText(/time/i).first()).toBeVisible();
  });
});
