/**
 * Tatum webhook E2E tests
 *
 * Tests the /api/webhooks/tatum endpoint against the live Vercel deployment.
 * These tests call the endpoint directly (no browser) using Playwright's
 * request fixture and verify side-effects via the Supabase admin client.
 */

import * as crypto from "crypto";
import * as path from "path";

import * as dotenv from "dotenv";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { ensureUserAccount, uid } from "./helpers";

// Load env vars (Supabase keys + webhook secret)
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env.test"), override: true });

const WEBHOOK_SECRET = process.env.TATUM_WEBHOOK_SECRET ?? "";
const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function signPayload(body: string): string {
  return crypto.createHmac("sha512", WEBHOOK_SECRET).update(body).digest("hex");
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Poll `fn` every `intervalMs` until it returns a truthy value or `timeoutMs` expires.
 */
async function pollUntil<T>(
  fn: () => Promise<T | null | undefined>,
  { timeoutMs = 10_000, intervalMs = 500 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await fn();
    if (result) return result;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`pollUntil: timed out after ${timeoutMs}ms`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Tatum webhook auto-approval", () => {
  test.describe.configure({ timeout: 60_000 });

  // -------------------------------------------------------------------------
  // 1. Happy path — tier-1 tx_hash match → deposit approved
  // -------------------------------------------------------------------------

  test("valid signed webhook auto-approves deposit (tier-1 tx_hash match)", async ({ request }) => {
    const admin = getAdminClient();

    // Create a test user and insert a pending deposit
    const userEmail = `webhooktest+${uid()}@example.com`;
    const { profileId } = await ensureUserAccount({ email: userEmail, password: "TestPass123!" });

    const txHash = `0xWHK${uid().toUpperCase()}`;

    const { data: deposit, error: depositError } = await admin
      .from("deposits")
      .insert({
        profile_id: profileId,
        asset_symbol: "USDT",
        network_name: "Ethereum (ERC-20)",
        amount_expected: "50",
        tx_hash: txHash,
        status: "pending",
      })
      .select("id")
      .single();

    expect(depositError).toBeNull();
    const depositId = (deposit as { id: string }).id;

    // Build and sign webhook payload
    const payload = {
      subscriptionType: "INCOMING_FUNGIBLE_TX",
      txId: txHash,
      address: "0xPlatformAddress",
      counterAddress: "0xSenderAddress",
      amount: "50",
      chain: "ETH",
      tokenSymbol: "USDT",
    };
    const body = JSON.stringify(payload);
    const signature = signPayload(body);

    // POST to webhook endpoint
    const response = await request.post(`${BASE_URL}/api/webhooks/tatum`, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "x-payload-hash": signature,
      },
    });

    expect(response.status()).toBe(200);
    const json = (await response.json()) as { success: boolean };
    expect(json.success).toBe(true);

    // Poll until deposit is approved (webhook processes async)
    const updated = await pollUntil(async () => {
      const { data } = await admin
        .from("deposits")
        .select("status")
        .eq("id", depositId)
        .single();
      return (data as { status: string } | null)?.status === "approved"
        ? (data as { status: string })
        : null;
    }, { timeoutMs: 10_000 });

    expect(updated.status).toBe("approved");
  });

  // -------------------------------------------------------------------------
  // 2. Invalid signature → 401
  // -------------------------------------------------------------------------

  test("invalid signature is rejected with 401", async ({ request }) => {
    const payload = {
      txId: `0xFAKE${uid()}`,
      address: "0xFakeAddress",
      amount: "1",
      chain: "ETH",
    };
    const body = JSON.stringify(payload);

    const response = await request.post(`${BASE_URL}/api/webhooks/tatum`, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "x-payload-hash": "deadbeefdeadbeef",
      },
    });

    expect(response.status()).toBe(401);
  });

  // -------------------------------------------------------------------------
  // 3. Duplicate webhook → idempotent (both return 200, only one log entry)
  // -------------------------------------------------------------------------

  test("duplicate webhook is safely ignored (idempotent)", async ({ request }) => {
    const admin = getAdminClient();

    const userEmail = `webhookdupe+${uid()}@example.com`;
    const { profileId } = await ensureUserAccount({ email: userEmail, password: "TestPass123!" });

    const txHash = `0xDUPE${uid().toUpperCase()}`;

    await admin.from("deposits").insert({
      profile_id: profileId,
      asset_symbol: "BNB",
      amount_expected: "0.5",
      tx_hash: txHash,
      status: "pending",
    });

    const payload = {
      subscriptionType: "INCOMING_NATIVE_TX",
      txId: txHash,
      address: "0xPlatformBscAddress",
      amount: "0.5",
      chain: "BSC",
    };
    const body = JSON.stringify(payload);
    const signature = signPayload(body);

    const headers = { "Content-Type": "application/json", "x-payload-hash": signature };

    // Send the exact same payload twice
    const [r1, r2] = await Promise.all([
      request.post(`${BASE_URL}/api/webhooks/tatum`, { data: body, headers }),
      request.post(`${BASE_URL}/api/webhooks/tatum`, { data: body, headers }),
    ]);

    expect(r1.status()).toBe(200);
    expect(r2.status()).toBe(200);

    // Wait for processing to settle
    await new Promise((r) => setTimeout(r, 3_000));

    // There should be exactly one log entry for this txId
    const { data: logs } = await admin
      .from("tatum_webhook_logs")
      .select("id, processing_status")
      .eq("tatum_tx_id", txHash);

    expect((logs as unknown[]).length).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 4. No matching deposit → logged as "skipped"
  // -------------------------------------------------------------------------

  test("webhook with no matching deposit is logged as skipped", async ({ request }) => {
    const admin = getAdminClient();

    const txHash = `0xNOMATCH${uid().toUpperCase()}`;

    const payload = {
      subscriptionType: "INCOMING_NATIVE_TX",
      txId: txHash,
      address: "0xUnknownAddress",
      amount: "1",
      chain: "BTC",
    };
    const body = JSON.stringify(payload);
    const signature = signPayload(body);

    const response = await request.post(`${BASE_URL}/api/webhooks/tatum`, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "x-payload-hash": signature,
      },
    });

    expect(response.status()).toBe(200);

    // Poll until the log entry shows "skipped"
    const log = await pollUntil(async () => {
      const { data } = await admin
        .from("tatum_webhook_logs")
        .select("processing_status")
        .eq("tatum_tx_id", txHash)
        .maybeSingle();
      return (data as { processing_status: string } | null)?.processing_status === "skipped"
        ? data
        : null;
    }, { timeoutMs: 10_000 });

    expect((log as { processing_status: string }).processing_status).toBe("skipped");
  });
});
