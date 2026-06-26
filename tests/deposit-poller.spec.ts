/**
 * Deposit poller E2E tests
 *
 * Covers the POST /api/wallet/check-deposits endpoint and the wallet page
 * balance auto-refresh that the DepositPoller component relies on.
 */

import * as path from "path";

import * as dotenv from "dotenv";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { ensureUserAccount, loginAs, uid, ADMIN_EMAIL } from "./helpers";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env.test"), override: true });

const ENDPOINT = "/api/wallet/check-deposits";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getProfileId(email: string): Promise<string> {
  const admin = getAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();
  if (!data?.id) throw new Error(`Profile not found for ${email}`);
  return data.id as string;
}

async function getAdminProfileId(): Promise<string> {
  return getProfileId(ADMIN_EMAIL);
}

// ---------------------------------------------------------------------------
// 1. Auth guard
// ---------------------------------------------------------------------------

test.describe("POST /api/wallet/check-deposits — auth", () => {
  test("returns 401 when not authenticated", async ({ request }) => {
    const res = await request.post(ENDPOINT);
    expect(res.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// 2. Authenticated — returns valid shape
// ---------------------------------------------------------------------------

test.describe("POST /api/wallet/check-deposits — authenticated", () => {
  test.describe.configure({ timeout: 30_000 });

  test("returns { success: true, credited: number } for logged-in user", async ({ page }) => {
    const email = `polltest+${uid()}@example.com`;
    await ensureUserAccount({ email, password: "TestPass123!" });
    await loginAs(page, email, "TestPass123!");

    const res = await page.request.post(ENDPOINT);
    expect(res.ok()).toBe(true);

    const body = (await res.json()) as { success: boolean; credited: number };
    expect(body.success).toBe(true);
    expect(typeof body.credited).toBe("number");
    expect(body.credited).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Rate limiting — 12 allowed per 60s, 13th is rejected
// ---------------------------------------------------------------------------

test.describe("POST /api/wallet/check-deposits — rate limit", () => {
  test.describe.configure({ timeout: 60_000 });

  test("returns 429 after exceeding 12 requests per minute", async ({ page }) => {
    const email = `ratelimit+${uid()}@example.com`;
    await ensureUserAccount({ email, password: "TestPass123!" });
    await loginAs(page, email, "TestPass123!");

    // Fire 13 sequential requests — all hit the same dev-server process
    const statuses: number[] = [];
    for (let i = 0; i < 13; i++) {
      const res = await page.request.post(ENDPOINT);
      statuses.push(res.status());
    }

    const limited = statuses.filter((s) => s === 429);
    expect(limited.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Wallet page balance updates when a deposit is credited
//
// This verifies the full chain the DepositPoller relies on:
//   approve_deposit() credits the wallet → router.refresh() re-renders
//   the server component → user sees the new balance.
//
// We simulate router.refresh() by navigating to /wallet again — the
// underlying mechanism is identical (fresh server render from DB).
// ---------------------------------------------------------------------------

test.describe("Wallet page — balance reflects credited deposit", () => {
  test.describe.configure({ timeout: 60_000 });

  test("balance updates on /wallet after a deposit is credited", async ({ page }) => {
    const admin = getAdminClient();
    const email = `walletrefresh+${uid()}@example.com`;
    const { profileId } = await ensureUserAccount({ email, password: "TestPass123!" });
    const adminProfileId = await getAdminProfileId();

    await loginAs(page, email, "TestPass123!");
    await page.goto("/wallet");

    // Confirm starting balance is $0.00
    await expect(page.getByText("$0.00").first()).toBeVisible();

    // Credit $25 USDT via approve_deposit (same path the poller uses)
    const txHash = `0xPOLLTEST${uid().toUpperCase()}`;

    const { data: deposit, error: depErr } = await admin
      .from("deposits")
      .insert({
        profile_id: profileId,
        deposit_address: "0x0000000000000000000000000000000000000000",
        asset_symbol: "USDT",
        network_name: "BNB Smart Chain (BEP-20)",
        amount_expected: 25,
        amount_received: 25,
        tx_hash: txHash,
        status: "pending",
      })
      .select("id")
      .single();

    expect(depErr).toBeNull();

    const { error: rpcErr } = await admin.rpc("approve_deposit", {
      p_deposit_id: (deposit as { id: string }).id,
      p_admin_profile_id: adminProfileId,
      p_amount_received: 25,
      p_admin_notes: "Playwright deposit poller test",
    });

    expect(rpcErr).toBeNull();

    // Navigate to /wallet again — simulates router.refresh()
    await page.goto("/wallet");

    // Balance and transaction entry should both reflect the credit
    await expect(page.getByText("$25.00").first()).toBeVisible();
    await expect(page.getByText("+$25.00 USDT")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 5. Support chat send — POST /api/support/messages
// ---------------------------------------------------------------------------

test.describe("POST /api/support/messages — send", () => {
  test.describe.configure({ timeout: 30_000 });

  test("returns 401 when not authenticated", async ({ request }) => {
    const res = await request.post("/api/support/messages", {
      data: { body: "Hello" },
    });
    expect(res.status()).toBe(401);
  });

  test("authenticated user can send a message and receives it back", async ({ page }) => {
    const email = `chattest+${uid()}@example.com`;
    await ensureUserAccount({ email, password: "TestPass123!" });
    await loginAs(page, email, "TestPass123!");

    const messageText = `Test message ${uid()}`;
    const res = await page.request.post("/api/support/messages", {
      data: { body: messageText },
    });

    expect(res.status()).toBe(201);
    const body = (await res.json()) as {
      success: boolean;
      message: { body: string; sender_role: string };
    };
    expect(body.success).toBe(true);
    expect(body.message.body).toBe(messageText);
    expect(body.message.sender_role).toBe("user");
  });

  test("returns 400 for empty message body", async ({ page }) => {
    const email = `chatbad+${uid()}@example.com`;
    await ensureUserAccount({ email, password: "TestPass123!" });
    await loginAs(page, email, "TestPass123!");

    const res = await page.request.post("/api/support/messages", {
      data: { body: "" },
    });
    expect(res.status()).toBe(400);
  });
});
