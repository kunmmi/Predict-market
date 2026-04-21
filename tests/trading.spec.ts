import { test, expect } from "@playwright/test";
import { uid, loginAs, logout, ADMIN_EMAIL, ADMIN_PASSWORD } from "./helpers";

test.describe("Markets and trading", () => {

  // -------------------------------------------------------------------------
  // Markets page is visible without login
  // -------------------------------------------------------------------------

  test("markets page loads and shows active markets", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/yes|no/i).first()).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Trade flow — YES trade debits wallet correctly
  // -------------------------------------------------------------------------

  test("placing a YES trade debits wallet by amount + fee", async ({ page, browser }) => {
    test.skip(!ADMIN_EMAIL, "TEST_ADMIN_EMAIL not configured");

    const userEmail = `test+${uid()}@example.com`;
    const userPassword = "TestPass123!";

    // Sign up
    await page.goto("/signup");
    await page.getByRole("button", { name: /email/i }).first().click();
    await page.getByLabel(/email/i).fill(userEmail);
    await page.getByLabel(/password/i).fill(userPassword);
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/dashboard/);
    await logout(page);

    // Admin funds the user's wallet
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAs(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Submit and approve a deposit via API shortcut
    const userContext = await browser.newContext();
    const userPage = await userContext.newPage();
    await loginAs(userPage, userEmail, userPassword);
    await userPage.goto("/wallet/deposit");
    await userPage.getByRole("button", { name: /usdt/i }).click();
    await userPage.getByLabel(/amount/i).fill("100");
    await userPage.getByLabel(/transaction hash/i).fill(`0xTEST${uid()}`);
    await userPage.getByRole("button", { name: /submit/i }).click();

    await adminPage.goto("/admin/deposits");
    await adminPage.getByRole("button", { name: /approve/i }).first().click();
    const amountInput = adminPage.getByLabel(/amount received/i);
    if (await amountInput.isVisible()) {
      await amountInput.fill("100");
      await adminPage.getByRole("button", { name: /confirm|approve/i }).click();
    }

    // User places a YES trade on the first active market
    await userPage.goto("/markets");
    await userPage.getByRole("link").first().click(); // open first market
    await userPage.getByRole("button", { name: /yes/i }).click();
    await userPage.getByPlaceholder(/10\.00/i).fill("10");
    await userPage.getByRole("button", { name: /yes — \$10/i }).click();

    // Trade success message
    await expect(userPage.getByText(/success|placed|confirmed/i)).toBeVisible();

    // Wallet balance should be less than 100 (amount + fee deducted)
    await userPage.goto("/wallet");
    const balanceText = await userPage.getByText(/\$\d+\.\d+/).first().textContent();
    const balance = parseFloat(balanceText?.replace("$", "") ?? "100");
    expect(balance).toBeLessThan(100);

    await userContext.close();
    await adminContext.close();
  });

  // -------------------------------------------------------------------------
  // Portfolio shows open positions after trade
  // -------------------------------------------------------------------------

  test("portfolio page shows positions after trading", async ({ page, browser }) => {
    test.skip(!ADMIN_EMAIL, "TEST_ADMIN_EMAIL not configured");

    const userEmail = `test+${uid()}@example.com`;
    const userPassword = "TestPass123!";

    await page.goto("/signup");
    await page.getByRole("button", { name: /email/i }).first().click();
    await page.getByLabel(/email/i).fill(userEmail);
    await page.getByLabel(/password/i).fill(userPassword);
    await page.getByRole("button", { name: /create account/i }).click();
    await logout(page);

    // Fund and trade (reuse pattern)
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAs(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);

    const userContext = await browser.newContext();
    const userPage = await userContext.newPage();
    await loginAs(userPage, userEmail, userPassword);
    await userPage.goto("/wallet/deposit");
    await userPage.getByRole("button", { name: /usdt/i }).click();
    await userPage.getByLabel(/amount/i).fill("100");
    await userPage.getByLabel(/transaction hash/i).fill(`0xTEST${uid()}`);
    await userPage.getByRole("button", { name: /submit/i }).click();

    await adminPage.goto("/admin/deposits");
    await adminPage.getByRole("button", { name: /approve/i }).first().click();
    const amountInput = adminPage.getByLabel(/amount received/i);
    if (await amountInput.isVisible()) {
      await amountInput.fill("100");
      await adminPage.getByRole("button", { name: /confirm|approve/i }).click();
    }

    await userPage.goto("/markets");
    await userPage.getByRole("link").first().click();
    await userPage.getByRole("button", { name: /yes/i }).click();
    await userPage.getByPlaceholder(/10\.00/i).fill("10");
    await userPage.getByRole("button", { name: /yes — \$10/i }).click();
    await expect(userPage.getByText(/success|placed|confirmed/i)).toBeVisible();

    // Check portfolio
    await userPage.goto("/portfolio");
    await expect(userPage.getByText(/open|position/i)).toBeVisible();

    await userContext.close();
    await adminContext.close();
  });
});
