import { test, expect } from "@playwright/test";

import {
  TEST_PROMOTER_EMAIL,
  TEST_REFERRED_EMAIL,
  TEST_SHARED_PASSWORD,
} from "./global-setup";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  approveDepositByTxHash,
  createActiveMarket,
  ensureReferralLink,
  ensurePromoterProfile,
  loginAs,
  uid,
} from "./helpers";

test.describe("Promoter and referral flow", () => {
  test.describe.configure({ timeout: 120000 });

  test("user can register as a promoter and see promo code", async ({ page }) => {
    const email = TEST_PROMOTER_EMAIL;
    const password = TEST_SHARED_PASSWORD;

    await loginAs(page, email, password);

    const displayName = `Promoter ${uid()}`;
    const promoter = await ensurePromoterProfile(email, displayName);

    await page.goto("/promoter");
    await expect(page.getByRole("heading", { name: /promoter dashboard/i })).toBeVisible();
    await expect(
      page.locator("p", { hasText: /promo code:/i }).locator("code").filter({ hasText: promoter.promoCode }),
    ).toBeVisible();
  });

  test("referred user signup links referral to promoter", async ({ browser }) => {
    const promoterEmail = TEST_PROMOTER_EMAIL;
    const referredEmail = TEST_REFERRED_EMAIL;
    const password = TEST_SHARED_PASSWORD;

    const promoterContext = await browser.newContext();
    const promoterPage = await promoterContext.newPage();
    await loginAs(promoterPage, promoterEmail, password);

    const promoter = await ensurePromoterProfile(promoterEmail, `Promo ${uid()}`);
    await promoterPage.goto("/promoter");
    await expect(
      promoterPage
        .locator("p", { hasText: /promo code:/i })
        .locator("code")
        .filter({ hasText: promoter.promoCode }),
    ).toBeVisible();

    await ensureReferralLink(referredEmail, promoter.promoCode);

    await promoterPage.goto("/promoter/referrals");
    await expect(promoterPage.getByRole("cell", { name: promoter.promoCode })).toBeVisible();

    await promoterContext.close();
  });

  test("commission is created when referred user places a trade", async ({ browser }) => {
    const promoterEmail = TEST_PROMOTER_EMAIL;
    const referredEmail = TEST_REFERRED_EMAIL;
    const password = TEST_SHARED_PASSWORD;

    const promoterContext = await browser.newContext();
    const promoterPage = await promoterContext.newPage();
    await loginAs(promoterPage, promoterEmail, password);

    const promoter = await ensurePromoterProfile(promoterEmail, `Promo ${uid()}`);
    await promoterPage.goto("/promoter");
    await expect(
      promoterPage
        .locator("p", { hasText: /promo code:/i })
        .locator("code")
        .filter({ hasText: promoter.promoCode }),
    ).toBeVisible();

    await ensureReferralLink(referredEmail, promoter.promoCode);

    const userContext = await browser.newContext();
    const userPage = await userContext.newPage();
    await loginAs(userPage, referredEmail, password);

    await userPage.goto("/wallet/deposit");
    await userPage.getByRole("button", { name: /usdt/i }).click();
    await userPage.getByLabel(/amount/i).fill("100");
    const txHash = `0xTEST${uid()}`;
    await userPage.getByLabel(/transaction hash/i).fill(txHash);
    await userPage.getByRole("button", { name: /submit/i }).click();
    await approveDepositByTxHash(txHash, 100);
    const market = await createActiveMarket();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAs(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);

    await userPage.goto(`/markets/${market.slug}`);
    await userPage.getByRole("button", { name: /^yes @/i }).click();
    await userPage.getByPlaceholder(/10\.00/i).fill("10");
    await userPage.getByRole("button", { name: /yes.*\$10/i }).click();
    await expect(userPage.getByText(/success|placed|confirmed/i)).toBeVisible();

    await adminPage.goto("/admin/commissions");
    await expect(adminPage.getByText(/pending/i)).toBeVisible();

    await promoterPage.goto("/promoter/commissions");
    await expect(promoterPage.getByRole("heading", { name: /commission history/i })).toBeVisible();

    await promoterContext.close();
    await userContext.close();
    await adminContext.close();
  });
});
