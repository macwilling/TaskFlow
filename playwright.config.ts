import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: "html",
  globalSetup: "./tests/e2e/fixtures/global-setup.ts",
  globalTeardown: "./tests/e2e/fixtures/global-teardown.ts",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    // Auth setup — verifies the storageState written by global-setup.ts
    {
      name: "auth-setup",
      testMatch: /auth\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "./tests/e2e/fixtures/.auth/admin.json",
      },
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Each spec that needs auth loads storageState via test.use() directly
      },
      // Auth setup must complete before any other test
      dependencies: ["auth-setup"],
    },
  ],
  webServer: process.env.CI
    ? {
        command: "npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: false,
      }
    : undefined,
});
