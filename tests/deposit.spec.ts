import { test, expect } from "@playwright/test";
import { uid, loginAs, logout, ADMIN_EMAIL, ADMIN_PASSWORD } from "./helpers";

test.describe("Deposit flow", () => {
  test.skip(!ADMIN_EMAIL, "TEST_ADMIN_EMAIL not configured");

  let userEmail: string;
  const userPassword = "TestPass123!";

  test.beforeEach(async ({ page }) => {
    // Create a fresh test user for each test
    userEmail = `test+${uid()}@example.com`;
    await page.goto("/signup");
    await page.getByRole("button", { name: /email/i }).first().click();
    await page.getByLabel(/email/i).fill(userEmail);
    await page.getByLabel(/password/i).fill(userPassword);
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/dashboard/);
    await logout(page);
  });

  // -------------------------------------------------------------------------
  // Submit a deposit request
  // -------------------------------------------------------------------------

  test("user can submit a deposit request", async ({ page }) => {
    await loginAs(page, userEmail, userPassword);
    await page.goto("/wallet/deposit");

    // Select an asset
    await page.getByRole("button", { name: /usdt/i }).click();

    // Fill in amount and tx hash
    await page.getByLabel(/amount/i).fill("100");
    await page.getByLabel(/transaction hash/i).fill(`0xTEST${uid()}`);
    await page.getByRole("button", { name: /submit/i }).click();

    await expect(page.getByText(/pending|submitted|received/i)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Admin approves deposit → wallet is credited
  // -------------------------------------------------------------------------

  test("admin approves deposit and user wallet is credited", async ({ page, browser }) => {
    // User submits deposit
    const userContext = await browser.newContext();
    const userPage = await userContext.newPage();
    await loginAs(userPage, userEmail, userPassword);
    await userPage.goto("/wallet/deposit");
    await userPage.getByRole("button", { name: /usdt/i }).click();
    await userPage.getByLabel(/amount/i).fill("50");
    await userPage.getByLabel(/transaction hash/i).fill(`0xTEST${uid()}`);
    await userPage.getByRole("button", { name: /submit/i }).click();
    await expect(userPage.getByText(/pending|submitted|received/i)).toBeVisible();

    // Admin approves it
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAs(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
    await adminPage.goto("/admin/deposits");

    // Find the pending deposit and approve it
    await adminPage.getByRole("button", { name: /approve/i }).first().click();
    // Fill in amount if a modal appears
    const amountInput = adminPage.getByLabel(/amount received/i);
    if (await amountInput.isVisible()) {
      await amountInput.fill("50");
      await adminPage.getByRole("button", { name: /confirm|approve/i }).click();
    }
    await expect(adminPage.getByText(/approved/i).first()).toBeVisible();

    // User wallet should now show a balance
    await userPage.goto("/wallet");
    await expect(userPage.getByText(/50|balance/i)).toBeVisible();

    await userContext.close();
    await adminContext.close();
  });

  // -------------------------------------------------------------------------
  // Admin rejects deposit → wallet unchanged
  // -------------------------------------------------------------------------

  test("admin rejects deposit and user wallet stays at zero", async ({ page, browser }) => {
    const userContext = await browser.newContext();
    const userPage = await userContext.newPage();
    await loginAs(userPage, userEmail, userPassword);
    await userPage.goto("/wallet/deposit");
    await userPage.getByRole("button", { name: /usdt/i }).click();
    await userPage.getByLabel(/amount/i).fill("200");
    await userPage.getByLabel(/transaction hash/i).fill(`0xFAKE${uid()}`);
    await userPage.getByRole("button", { name: /submit/i }).click();
    await expect(userPage.getByText(/pending|submitted|received/i)).toBeVisible();

    // Admin rejects
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAs(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
    await adminPage.goto("/admin/deposits");
    await adminPage.getByRole("button", { name: /reject/i }).first().click();
    const notesInput = adminPage.getByLabel(/notes/i);
    if (await notesInput.isVisible()) {
      await notesInput.fill("Fake transaction hash");
      await adminPage.getByRole("button", { name: /confirm|reject/i }).click();
    }
    await expect(adminPage.getByText(/rejected/i).first()).toBeVisible();

    // User wallet should still be zero
    await userPage.goto("/wallet");
    await expect(userPage.getByText(/0\.00|no balance/i)).toBeVisible();

    await userContext.close();
    await adminContext.close();
  });
});
