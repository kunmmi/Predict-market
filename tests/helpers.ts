import { type Page, expect } from "@playwright/test";

export const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
export const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "";
export const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "";

/** Unique suffix so parallel test runs don't clash */
export function uid() {
  return Date.now().toString(36);
}

/** Log in via the UI and wait for the dashboard */
export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/email or username/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/);
}

/** Log out via the nav */
export async function logout(page: Page) {
  await page.goto("/api/auth/logout", { waitUntil: "commit" });
}
