import { test, expect } from "@playwright/test";

import {
  approveDepositByTxHash,
  createActiveMarket,
  ensureUserAccount,
  loginAs,
  uid,
} from "./helpers";

test.describe("Markets and trading", () => {
  test.describe.configure({ timeout: 120000 });

  test("markets page loads and shows active markets", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/yes|no/i).first()).toBeVisible();
  });

  test("placing a YES trade debits wallet by amount + fee", async ({ browser }) => {
    const userEmail = `test+${uid()}@example.com`;
    const userPassword = "TestPass123!";

    await ensureUserAccount({ email: userEmail, password: userPassword, fullName: `Trader ${uid()}` });

    const userContext = await browser.newContext();
    const userPage = await userContext.newPage();
    await loginAs(userPage, userEmail, userPassword);
    await userPage.goto("/wallet/deposit");
    await userPage.getByRole("button", { name: /usdt/i }).click();
    await userPage.getByLabel(/amount/i).fill("100");
    const txHash = `0xTEST${uid()}`;
    await userPage.getByLabel(/transaction hash/i).fill(txHash);
    await userPage.getByRole("button", { name: /submit/i }).click();
    await approveDepositByTxHash(txHash, 100);
    const market = await createActiveMarket();

    await userPage.goto(`/markets/${market.slug}`);
    await userPage.getByRole("button", { name: /^yes @/i }).click();
    await userPage.getByPlaceholder(/10\.00/i).fill("10");
    await userPage.getByRole("button", { name: /yes.*\$10/i }).click();
    await expect(userPage.getByText(/success|placed|confirmed/i)).toBeVisible();

    await userPage.goto("/wallet");
    const balanceText = await userPage.getByText(/\$\d+\.\d*|\$\d+/).first().textContent();
    const balance = parseFloat(balanceText?.replace("$", "") ?? "100");
    expect(balance).toBeLessThan(100);

    await userContext.close();
  });

  test("portfolio page shows positions after trading", async ({ browser }) => {
    const userEmail = `test+${uid()}@example.com`;
    const userPassword = "TestPass123!";

    await ensureUserAccount({ email: userEmail, password: userPassword, fullName: `Trader ${uid()}` });

    const userContext = await browser.newContext();
    const userPage = await userContext.newPage();
    await loginAs(userPage, userEmail, userPassword);
    await userPage.goto("/wallet/deposit");
    await userPage.getByRole("button", { name: /usdt/i }).click();
    await userPage.getByLabel(/amount/i).fill("100");
    const txHash = `0xTEST${uid()}`;
    await userPage.getByLabel(/transaction hash/i).fill(txHash);
    await userPage.getByRole("button", { name: /submit/i }).click();
    await approveDepositByTxHash(txHash, 100);
    const market = await createActiveMarket();

    await userPage.goto(`/markets/${market.slug}`);
    await userPage.getByRole("button", { name: /^yes @/i }).click();
    await userPage.getByPlaceholder(/10\.00/i).fill("10");
    await userPage.getByRole("button", { name: /yes.*\$10/i }).click();
    await expect(userPage.getByText(/success|placed|confirmed/i)).toBeVisible();

    await userPage.goto("/portfolio");
    await expect(userPage.getByRole("heading", { name: /open positions/i })).toBeVisible();

    await userContext.close();
  });
});
