import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env.test", override: true });

/**
 * Playwright E2E test configuration.
 *
 * Run against local dev server:
 *   npx playwright test
 *
 * Run against live Vercel deployment:
 *   TEST_BASE_URL=https://predict-market-xi.vercel.app npx playwright test
 *
 * Required env vars (copy from .env.local or set in your shell):
 *   TEST_BASE_URL       — defaults to http://localhost:3000
 *   TEST_ADMIN_EMAIL    — admin account email
 *   TEST_ADMIN_PASSWORD — admin account password
 *   TEST_USER_EMAIL     — a regular test user email
 *   TEST_USER_PASSWORD  — regular test user password
 */
export default defineConfig({
  globalSetup: require.resolve("./tests/global-setup"),
  testDir: "./tests",
  timeout: 60_000,
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:3000",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
