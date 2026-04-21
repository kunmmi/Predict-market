import { test, expect } from "@playwright/test";

import { TEST_SETTLEMENT_EMAIL, TEST_SHARED_PASSWORD } from "./global-setup";
import {
  approveDepositByTxHash,
  createActiveMarket,
  loginAs,
  settleMarketBySlug,
  uid,
} from "./helpers";

test.describe("Market settlement", () => {
  test.describe.configure({ timeout: 120000 });

  test("admin settles market YES and winning user wallet is credited", async ({ browser }) => {
    const userEmail = TEST_SETTLEMENT_EMAIL;
    const password = TEST_SHARED_PASSWORD;

    const userContext = await browser.newContext();
    const userPage = await userContext.newPage();
    await loginAs(userPage, userEmail, password);

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
    const balanceBefore = await userPage.getByText(/\$\d+\.\d*|\$\d+/).first().textContent();
    const before = parseFloat(balanceBefore?.replace("$", "") ?? "0");

    await settleMarketBySlug(market.slug, "yes", "Test settlement");

    await userPage.goto("/wallet");
    const balanceAfter = await userPage.getByText(/\$\d+\.\d*|\$\d+/).first().textContent();
    const after = parseFloat(balanceAfter?.replace("$", "") ?? "0");
    expect(after).toBeGreaterThan(before);

    await userPage.goto("/portfolio");
    await expect(userPage.getByRole("heading", { name: /settled positions/i })).toBeVisible();

    await userContext.close();
  });
});
