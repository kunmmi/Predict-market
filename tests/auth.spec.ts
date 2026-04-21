import { test, expect } from "@playwright/test";
import { uid, loginAs, logout, ADMIN_EMAIL, ADMIN_PASSWORD } from "./helpers";

// ---------------------------------------------------------------------------
// Sign up — Email
// ---------------------------------------------------------------------------

test("sign up with email then redirect to dashboard", async ({ page }) => {
  const email = `test+${uid()}@example.com`;

  await page.goto("/signup");
  await page.getByRole("button", { name: /email/i }).first().click();

  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill("TestPass123!");
  await page.getByRole("button", { name: /create account/i }).click();

  await expect(page).toHaveURL(/dashboard/);
});

// ---------------------------------------------------------------------------
// Sign up — Username
// ---------------------------------------------------------------------------

test("sign up with username then redirect to dashboard", async ({ page }) => {
  const username = `user_${uid()}`;

  await page.goto("/signup");
  await page.getByRole("button", { name: /username/i }).click();

  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/password/i).fill("TestPass123!");
  await page.getByRole("button", { name: /create account/i }).click();

  await expect(page).toHaveURL(/dashboard/);
});

// ---------------------------------------------------------------------------
// Login — Email
// ---------------------------------------------------------------------------

test("login with email", async ({ page }) => {
  const email = `test+${uid()}@example.com`;
  const password = "TestPass123!";

  // Sign up first
  await page.goto("/signup");
  await page.getByRole("button", { name: /email/i }).first().click();
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/dashboard/);

  // Log out then log back in
  await logout(page);
  await loginAs(page, email, password);
  await expect(page).toHaveURL(/dashboard/);
});

// ---------------------------------------------------------------------------
// Login — Username
// ---------------------------------------------------------------------------

test("login with username", async ({ page }) => {
  const username = `user_${uid()}`;

  // First create the username account
  await page.goto("/signup");
  await page.getByRole("button", { name: /username/i }).click();
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/password/i).fill("TestPass123!");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/dashboard/);

  // Log out then log back in with username
  await logout(page);
  await loginAs(page, username, "TestPass123!");
  await expect(page).toHaveURL(/dashboard/);
});

// ---------------------------------------------------------------------------
// Login — Wrong password shows error
// ---------------------------------------------------------------------------

test("login with wrong password shows error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email or username/i).fill("nobody@example.com");
  await page.getByLabel(/password/i).fill("wrongpassword");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page.getByText(/invalid credentials/i)).toBeVisible();
  await expect(page).toHaveURL(/login/);
});

// ---------------------------------------------------------------------------
// Forgot password page renders
// ---------------------------------------------------------------------------

test("forgot password page is accessible from login", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: /forgot password/i }).click();
  await expect(page).toHaveURL(/forgot-password/);
  await expect(page.getByRole("button", { name: /send reset link/i })).toBeVisible();
});

// ---------------------------------------------------------------------------
// Duplicate username is rejected
// ---------------------------------------------------------------------------

test("signing up with an existing username shows an error", async ({ page }) => {
  const username = `user_${uid()}`;

  // Create first account
  await page.goto("/signup");
  await page.getByRole("button", { name: /username/i }).click();
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/password/i).fill("TestPass123!");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/dashboard/);
  await logout(page);

  // Try to create a second account with the same username
  await page.goto("/signup");
  await page.getByRole("button", { name: /username/i }).click();
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/password/i).fill("AnotherPass456!");
  await page.getByRole("button", { name: /create account/i }).click();

  await expect(page.getByText(/already taken/i)).toBeVisible();
});
