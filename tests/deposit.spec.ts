import { test, expect } from "@playwright/test";

import {
  approveDepositByTxHash,
  loginAs,
  logout,
  rejectDepositByTxHash,
  uid,
} from "./helpers";

test.describe("Deposit flow", () => {
  let userEmail: string;
  const userPassword = "TestPass123!";

  test.beforeEach(async ({ page }) => {
    userEmail = `test+${uid()}@example.com`;
    await page.goto("/signup");
    await page.getByRole("button", { name: /email/i }).first().click();
    await page.getByLabel(/email/i).fill(userEmail);
    await page.getByLabel(/password/i).fill(userPassword);
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/dashboard/);
    await logout(page);
  });

  test("user can submit a deposit request", async ({ page }) => {
    await loginAs(page, userEmail, userPassword);
    await page.goto("/wallet/deposit");
    await page.getByRole("button", { name: /usdt/i }).click();
    await page.getByLabel(/amount/i).fill("100");
    await page.getByLabel(/transaction hash/i).fill(`0xTEST${uid()}`);
    await page.getByRole("button", { name: /submit/i }).click();

    await expect(page.getByText(/pending|submitted|received/i)).toBeVisible();
  });

  test("admin approves deposit and user wallet is credited", async ({ browser }) => {
    const userContext = await browser.newContext();
    const userPage = await userContext.newPage();

    await loginAs(userPage, userEmail, userPassword);
    await userPage.goto("/wallet/deposit");
    await userPage.getByRole("button", { name: /usdt/i }).click();
    await userPage.getByLabel(/amount/i).fill("50");
    const txHash = `0xTEST${uid()}`;
    await userPage.getByLabel(/transaction hash/i).fill(txHash);
    await userPage.getByRole("button", { name: /submit/i }).click();
    await expect(userPage.getByText(/pending|submitted|received/i)).toBeVisible();

    await approveDepositByTxHash(txHash, 50);

    await userPage.goto("/wallet");
    await expect(userPage.getByText("$50", { exact: true }).first()).toBeVisible();
    await expect(userPage.getByText("+$50 USDT", { exact: true })).toBeVisible();

    await userContext.close();
  });

  test("admin rejects deposit and user wallet stays at zero", async ({ browser }) => {
    const userContext = await browser.newContext();
    const userPage = await userContext.newPage();

    await loginAs(userPage, userEmail, userPassword);
    await userPage.goto("/wallet/deposit");
    await userPage.getByRole("button", { name: /usdt/i }).click();
    await userPage.getByLabel(/amount/i).fill("200");
    const txHash = `0xFAKE${uid()}`;
    await userPage.getByLabel(/transaction hash/i).fill(txHash);
    await userPage.getByRole("button", { name: /submit/i }).click();
    await expect(userPage.getByText(/pending|submitted|received/i)).toBeVisible();

    await rejectDepositByTxHash(txHash, "Fake transaction hash");

    await userPage.goto("/wallet");
    await expect(userPage.getByText("$0", { exact: true }).first()).toBeVisible();
    await expect(userPage.getByText(/no transactions yet/i)).toBeVisible();

    await userContext.close();
  });
});
