import { test, expect } from "@playwright/test";
import { uid, loginAs, logout, ADMIN_EMAIL, ADMIN_PASSWORD } from "./helpers";

test.describe("Promoter and referral flow", () => {
  test.skip(!ADMIN_EMAIL, "TEST_ADMIN_EMAIL not configured");

  // -------------------------------------------------------------------------
  // Register as a promoter
  // -------------------------------------------------------------------------

  test("user can register as a promoter and see promo code", async ({ page }) => {
    const email = `test+${uid()}@example.com`;
    const password = "TestPass123!";

    // Sign up
    await page.goto("/signup");
    await page.getByRole("button", { name: /email/i }).first().click();
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/dashboard/);

    // Register as promoter
    await page.goto("/promoter/register");
    await page.getByLabel(/display name/i).fill(`Promoter ${uid()}`);
    await page.getByRole("button", { name: /register|become/i }).click();

    // Should see the promoter dashboard with a promo code
    await expect(page).toHaveURL(/promoter/);
    await expect(page.getByText(/promo code/i)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Referred user signs up with promo code → referral is recorded
  // -------------------------------------------------------------------------

  test("referred user signup links referral to promoter", async ({ page, browser }) => {
    const promoterEmail = `promoter+${uid()}@example.com`;
    const password = "TestPass123!";

    // Create and register promoter
    const promoterContext = await browser.newContext();
    const promoterPage = await promoterContext.newPage();
    await promoterPage.goto("/signup");
    await promoterPage.getByRole("button", { name: /email/i }).first().click();
    await promoterPage.getByLabel(/email/i).fill(promoterEmail);
    await promoterPage.getByLabel(/password/i).fill(password);
    await promoterPage.getByRole("button", { name: /create account/i }).click();
    await promoterPage.goto("/promoter/register");
    await promoterPage.getByLabel(/display name/i).fill(`Promo ${uid()}`);
    await promoterPage.getByRole("button", { name: /register|become/i }).click();

    // Grab the promo code from the dashboard
    await promoterPage.goto("/promoter");
    const promoCodeEl = promoterPage.getByTestId("promo-code").or(
      promoterPage.locator("text=/[A-Z0-9]{8,}/")
    ).first();
    const promoCode = await promoCodeEl.textContent();
    expect(promoCode).toBeTruthy();

    // New user signs up with promo code
    const userContext = await browser.newContext();
    const userPage = await userContext.newPage();
    await userPage.goto("/signup");
    await userPage.getByRole("button", { name: /email/i }).first().click();
    await userPage.getByLabel(/email/i).fill(`referred+${uid()}@example.com`);
    await userPage.getByLabel(/password/i).fill(password);
    await userPage.getByPlaceholder(/promo/i).fill(promoCode!.trim());
    await userPage.getByRole("button", { name: /create account/i }).click();
    await expect(userPage).toHaveURL(/dashboard/);

    // Promoter dashboard should show 1 referral
    await promoterPage.goto("/promoter/referrals");
    await expect(promoterPage.getByText(/1|referred/i)).toBeVisible();

    await promoterContext.close();
    await userContext.close();
  });

  // -------------------------------------------------------------------------
  // Commission is generated when referred user trades
  // -------------------------------------------------------------------------

  test("commission is created when referred user places a trade", async ({ page, browser }) => {
    const promoterEmail = `promoter+${uid()}@example.com`;
    const referredEmail = `referred+${uid()}@example.com`;
    const password = "TestPass123!";

    // Set up promoter
    const promoterContext = await browser.newContext();
    const promoterPage = await promoterContext.newPage();
    await promoterPage.goto("/signup");
    await promoterPage.getByRole("button", { name: /email/i }).first().click();
    await promoterPage.getByLabel(/email/i).fill(promoterEmail);
    await promoterPage.getByLabel(/password/i).fill(password);
    await promoterPage.getByRole("button", { name: /create account/i }).click();
    await promoterPage.goto("/promoter/register");
    await promoterPage.getByLabel(/display name/i).fill(`Promo ${uid()}`);
    await promoterPage.getByRole("button", { name: /register|become/i }).click();
    await promoterPage.goto("/promoter");
    const promoCodeEl = promoterPage.locator("text=/[A-Z0-9]{8,}/").first();
    const promoCode = await promoCodeEl.textContent();

    // Referred user signs up
    const userContext = await browser.newContext();
    const userPage = await userContext.newPage();
    await userPage.goto("/signup");
    await userPage.getByRole("button", { name: /email/i }).first().click();
    await userPage.getByLabel(/email/i).fill(referredEmail);
    await userPage.getByLabel(/password/i).fill(password);
    await userPage.getByPlaceholder(/promo/i).fill(promoCode!.trim());
    await userPage.getByRole("button", { name: /create account/i }).click();

    // Fund referred user wallet
    await userPage.goto("/wallet/deposit");
    await userPage.getByRole("button", { name: /usdt/i }).click();
    await userPage.getByLabel(/amount/i).fill("100");
    await userPage.getByLabel(/transaction hash/i).fill(`0xTEST${uid()}`);
    await userPage.getByRole("button", { name: /submit/i }).click();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAs(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
    await adminPage.goto("/admin/deposits");
    await adminPage.getByRole("button", { name: /approve/i }).first().click();
    const amountInput = adminPage.getByLabel(/amount received/i);
    if (await amountInput.isVisible()) {
      await amountInput.fill("100");
      await adminPage.getByRole("button", { name: /confirm|approve/i }).click();
    }

    // Referred user trades
    await userPage.goto("/markets");
    await userPage.getByRole("link").first().click();
    await userPage.getByRole("button", { name: /yes/i }).click();
    await userPage.getByPlaceholder(/10\.00/i).fill("10");
    await userPage.getByRole("button", { name: /yes — \$10/i }).click();
    await expect(userPage.getByText(/success|placed|confirmed/i)).toBeVisible();

    // Admin commissions page should show a pending commission
    await adminPage.goto("/admin/commissions");
    await expect(adminPage.getByText(/pending/i)).toBeVisible();

    // Promoter commissions page should show earnings
    await promoterPage.goto("/promoter/commissions");
    await expect(promoterPage.getByText(/commission|earned/i)).toBeVisible();

    await promoterContext.close();
    await userContext.close();
    await adminContext.close();
  });
});
