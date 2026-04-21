import { test, expect } from "@playwright/test";
import { uid, loginAs, logout, ADMIN_EMAIL, ADMIN_PASSWORD } from "./helpers";

test.describe("Market settlement", () => {
  test.skip(!ADMIN_EMAIL, "TEST_ADMIN_EMAIL not configured");

  test("admin settles market YES → winning user wallet is credited", async ({ page, browser }) => {
    const userEmail = `test+${uid()}@example.com`;
    const password = "TestPass123!";

    // Sign up user
    const userContext = await browser.newContext();
    const userPage = await userContext.newPage();
    await userPage.goto("/signup");
    await userPage.getByRole("button", { name: /email/i }).first().click();
    await userPage.getByLabel(/email/i).fill(userEmail);
    await userPage.getByLabel(/password/i).fill(password);
    await userPage.getByRole("button", { name: /create account/i }).click();

    // Fund user wallet
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

    // User places a YES trade
    await userPage.goto("/markets");
    await userPage.getByRole("link").first().click();

    // Grab the market URL to come back to it later
    const marketUrl = userPage.url();

    await userPage.getByRole("button", { name: /yes/i }).click();
    await userPage.getByPlaceholder(/10\.00/i).fill("10");
    await userPage.getByRole("button", { name: /yes — \$10/i }).click();
    await expect(userPage.getByText(/success|placed|confirmed/i)).toBeVisible();

    // Record wallet balance before settlement
    await userPage.goto("/wallet");
    const balanceBefore = await userPage.getByText(/\$\d+\.\d+/).first().textContent();
    const before = parseFloat(balanceBefore?.replace("$", "") ?? "0");

    // Admin settles the market as YES
    // Navigate to the market in admin
    const marketSlug = marketUrl.split("/markets/")[1];
    await adminPage.goto("/admin/markets");
    await adminPage.getByRole("link", { name: /edit/i }).first().click();
    await adminPage.getByRole("button", { name: /settle/i }).click();
    await adminPage.getByLabel(/outcome/i).selectOption("yes");
    const notesInput = adminPage.getByLabel(/notes/i);
    if (await notesInput.isVisible()) {
      await notesInput.fill("Test settlement");
    }
    await adminPage.getByRole("button", { name: /confirm|settle/i }).click();
    await expect(adminPage.getByText(/settled/i)).toBeVisible();

    // User's wallet should have increased (winning payout)
    await userPage.goto("/wallet");
    const balanceAfter = await userPage.getByText(/\$\d+\.\d+/).first().textContent();
    const after = parseFloat(balanceAfter?.replace("$", "") ?? "0");
    expect(after).toBeGreaterThan(before);

    // Portfolio should show settled position
    await userPage.goto("/portfolio");
    await expect(userPage.getByText(/settled/i)).toBeVisible();

    await userContext.close();
    await adminContext.close();
  });
});
