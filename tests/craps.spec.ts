import { test, expect } from "@playwright/test";
import {
  uid,
  loginAs,
  ensureUserAccount,
  approveDepositByTxHash,
} from "./helpers";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAdminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function fundUser(email: string, amount: number) {
  const txHash = `0xTEST_CRAPS_${uid()}`;
  // Submit deposit via DB directly (same approach as trading tests)
  const admin = getAdminDb();
  const profile = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();
  if (profile.error || !profile.data) throw new Error("Profile not found");

  const addr = await admin
    .from("deposit_addresses")
    .select("address")
    .eq("profile_id", profile.data.id)
    .limit(1)
    .maybeSingle();

  const depositInsert = await admin.from("deposits").insert({
    profile_id: profile.data.id,
    tx_hash: txHash,
    amount_expected: amount,
    asset_symbol: "USDT",
    network_name: "bsc",
    deposit_address: addr.data?.address ?? "0xTEST",
    status: "pending",
  });
  if (depositInsert.error) throw new Error(depositInsert.error.message);

  await approveDepositByTxHash(txHash, amount);
  return txHash;
}

// ---------------------------------------------------------------------------
// Page: /games/craps
// ---------------------------------------------------------------------------

test.describe("Craps game page", () => {
  test.describe.configure({ timeout: 60000 });

  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/games/craps");
    await expect(page).toHaveURL(/login/);
  });

  test("loads craps table for authenticated user", async ({ browser }) => {
    const email = `test+${uid()}@example.com`;
    await ensureUserAccount({ email, password: "TestPass123!" });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, "TestPass123!");
    await page.goto("/games/craps");

    await expect(page.getByRole("button", { name: /pass line/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /don't pass/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^.*field/i })).toBeVisible();
    await expect(page.getByText(/come.?out/i).first()).toBeVisible();
    await ctx.close();
  });

  test("demo mode: roll without real money shows outcome", async ({ browser }) => {
    const email = `test+${uid()}@example.com`;
    await ensureUserAccount({ email, password: "TestPass123!" });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, "TestPass123!");
    await page.goto("/games/craps");

    // Enable demo mode
    await page.getByRole("button", { name: /demo/i }).click();
    await expect(page.getByRole("button", { name: /demo on/i })).toBeVisible();

    // Roll without placing bets
    await page.getByRole("button", { name: /demo roll/i }).click();

    // Should show an outcome
    await expect(
      page.getByTestId("outcome-banner"),
    ).toBeVisible({ timeout: 5000 });

    await ctx.close();
  });

  test("demo mode: roll history strip populates after rolls", async ({ browser }) => {
    const email = `test+${uid()}@example.com`;
    await ensureUserAccount({ email, password: "TestPass123!" });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, "TestPass123!");
    await page.goto("/games/craps");

    await page.getByRole("button", { name: /demo/i }).click();

    // Roll 3 times
    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: /demo roll/i }).click();
      await page.waitForTimeout(900); // animation
    }

    await expect(page.getByText(/last rolls/i)).toBeVisible();

    await ctx.close();
  });

  test("real money: roll deducts bet from wallet balance", async ({ browser }) => {
    const email = `test+${uid()}@example.com`;
    await ensureUserAccount({ email, password: "TestPass123!" });
    await fundUser(email, 50);

    const admin = getAdminDb();
    const profile = await admin.from("profiles").select("id").eq("email", email).single();
    const profileId = profile.data!.id as string;

    // Verify starting balance in DB
    const before = await admin
      .from("wallets")
      .select("available_balance")
      .eq("profile_id", profileId)
      .single();
    expect(Number(before.data?.available_balance)).toBeCloseTo(50, 1);

    // Call the API directly (same approach as the "successful roll" API test)
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, "TestPass123!");

    const res = await page.request.post("/api/games/craps/roll", {
      data: { bets: [{ type: "pass_line", amount: 5 }], phase: "come_out" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    await ctx.close();

    // Verify balance changed in DB (debit always happens; win/loss shifts amount)
    const after = await admin
      .from("wallets")
      .select("available_balance")
      .eq("profile_id", profileId)
      .single();
    expect(Number(after.data?.available_balance)).not.toBeCloseTo(50, 1);
  });

  test("real money: craps_rounds row created after roll", async ({ browser }) => {
    const email = `test+${uid()}@example.com`;
    await ensureUserAccount({ email, password: "TestPass123!" });
    await fundUser(email, 20);

    const admin = getAdminDb();
    const profile = await admin.from("profiles").select("id").eq("email", email).single();
    const profileId = profile.data!.id as string;

    // Call the API directly with an authenticated session
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, "TestPass123!");

    const res = await page.request.post("/api/games/craps/roll", {
      data: { bets: [{ type: "pass_line", amount: 1 }], phase: "come_out" },
    });
    expect(res.status()).toBe(200);

    await ctx.close();

    // Verify audit record created in DB
    const { data, error } = await admin
      .from("craps_rounds")
      .select("id, outcome, die1, die2, total")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    expect(error).toBeNull();
    expect(data?.die1).toBeGreaterThanOrEqual(1);
    expect(data?.die1).toBeLessThanOrEqual(6);
    expect(data?.die2).toBeGreaterThanOrEqual(1);
    expect(data?.die2).toBeLessThanOrEqual(6);
    expect(data?.total).toBe((data?.die1 ?? 0) + (data?.die2 ?? 0));
    expect(["win", "loss", "push", "point_set", "point_hit", "seven_out", "continue"]).toContain(
      data?.outcome,
    );

    await ctx.close();
  });
});

// ---------------------------------------------------------------------------
// API: POST /api/games/craps/roll
// ---------------------------------------------------------------------------

test.describe("Craps API — /api/games/craps/roll", () => {
  test.describe.configure({ timeout: 30000 });

  test("returns 401 when unauthenticated", async ({ request }) => {
    const res = await request.post("/api/games/craps/roll", {
      data: {
        bets: [{ type: "pass_line", amount: 5 }],
        phase: "come_out",
      },
    });
    expect(res.status()).toBe(401);
  });

  test("returns 400 when bets array is empty", async ({ browser }) => {
    const email = `test+${uid()}@example.com`;
    await ensureUserAccount({ email, password: "TestPass123!" });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, "TestPass123!");

    const res = await page.request.post("/api/games/craps/roll", {
      data: { bets: [], phase: "come_out" },
    });
    expect(res.status()).toBe(400);
    await ctx.close();
  });

  test("returns 400 for invalid bet type", async ({ browser }) => {
    const email = `test+${uid()}@example.com`;
    await ensureUserAccount({ email, password: "TestPass123!" });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, "TestPass123!");

    const res = await page.request.post("/api/games/craps/roll", {
      data: {
        bets: [{ type: "hardway_4", amount: 5 }],
        phase: "come_out",
      },
    });
    expect(res.status()).toBe(400);
    await ctx.close();
  });

  test("returns 400 for point phase without point_number", async ({ browser }) => {
    const email = `test+${uid()}@example.com`;
    await ensureUserAccount({ email, password: "TestPass123!" });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, "TestPass123!");

    const res = await page.request.post("/api/games/craps/roll", {
      data: {
        bets: [{ type: "pass_line", amount: 5 }],
        phase: "point",
        // point_number intentionally omitted
      },
    });
    expect(res.status()).toBe(400);
    await ctx.close();
  });

  test("returns 400 for bet amount below minimum ($1)", async ({ browser }) => {
    const email = `test+${uid()}@example.com`;
    await ensureUserAccount({ email, password: "TestPass123!" });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, "TestPass123!");

    const res = await page.request.post("/api/games/craps/roll", {
      data: {
        bets: [{ type: "pass_line", amount: 0.5 }],
        phase: "come_out",
      },
    });
    expect(res.status()).toBe(400);
    await ctx.close();
  });

  test("returns 400 for bet amount above maximum ($500)", async ({ browser }) => {
    const email = `test+${uid()}@example.com`;
    await ensureUserAccount({ email, password: "TestPass123!" });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, "TestPass123!");

    const res = await page.request.post("/api/games/craps/roll", {
      data: {
        bets: [{ type: "pass_line", amount: 501 }],
        phase: "come_out",
      },
    });
    expect(res.status()).toBe(400);
    await ctx.close();
  });

  test("returns 400 when wallet has insufficient funds", async ({ browser }) => {
    const email = `test+${uid()}@example.com`;
    await ensureUserAccount({ email, password: "TestPass123!" });
    // Do NOT fund — balance is $0

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, "TestPass123!");

    const res = await page.request.post("/api/games/craps/roll", {
      data: {
        bets: [{ type: "pass_line", amount: 5 }],
        phase: "come_out",
      },
    });
    // Either 400 (validation) or 500 (DB debit fails) — both are acceptable,
    // the key thing is it must NOT be 200.
    expect(res.status()).not.toBe(200);
    await ctx.close();
  });

  test("successful roll returns valid dice and outcome fields", async ({ browser }) => {
    const email = `test+${uid()}@example.com`;
    await ensureUserAccount({ email, password: "TestPass123!" });
    await fundUser(email, 20);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, email, "TestPass123!");

    const res = await page.request.post("/api/games/craps/roll", {
      data: {
        bets: [{ type: "pass_line", amount: 1 }],
        phase: "come_out",
      },
    });

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.die1).toBeGreaterThanOrEqual(1);
    expect(body.die1).toBeLessThanOrEqual(6);
    expect(body.die2).toBeGreaterThanOrEqual(1);
    expect(body.die2).toBeLessThanOrEqual(6);
    expect(body.total).toBe(body.die1 + body.die2);
    expect(["win", "loss", "push", "point_set", "point_hit", "seven_out", "continue"]).toContain(
      body.outcome,
    );
    expect(body.new_balance).not.toBeNull();
    expect(Number(body.new_balance)).toBeGreaterThanOrEqual(0);

    await ctx.close();
  });
});
