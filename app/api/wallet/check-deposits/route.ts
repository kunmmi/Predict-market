/**
 * POST /api/wallet/check-deposits
 *
 * On-demand deposit detection for the authenticated user. Scans ONLY the
 * caller's own deposit address via the Moralis EVM API and credits any recent,
 * not-yet-recorded USDT (BEP-20) transfer. Designed to be polled from the
 * deposit page while a user is waiting, so their deposit shows up within
 * seconds of confirming on-chain instead of waiting for the 5-minute sweep.
 *
 * Same safety model as the background sweep: keyed Moralis source, 24h recency
 * guard (can't re-credit old transfers), dedup by tx_hash, idempotent.
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOrAssignDepositAddress } from "@/lib/services/deposit-address";
import { USDT_CONTRACT, USDT_DECIMALS } from "@/lib/blockchain/bsc-sweep";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_DEPOSIT_AGE_MS = 24 * 60 * 60 * 1000; // only auto-credit deposits from the last 24h

type Transfer = { txHash: string; amount: number };

async function fetchRecentTransfers(address: string): Promise<Transfer[]> {
  const apiKey = process.env.MORALIS_API_KEY;
  if (!apiKey) return [];

  const url = `https://deep-index.moralis.io/api/v2.2/${address}/erc20/transfers?chain=bsc&limit=30`;
  const res = await fetch(url, {
    headers: { "X-API-Key": apiKey, accept: "application/json" },
    cache: "no-store" as RequestCache,
  });
  if (!res.ok) {
    console.warn(`[check-deposits] Moralis API HTTP ${res.status} for ${address}`);
    return [];
  }

  const json = (await res.json()) as {
    result?: Array<{
      transaction_hash: string;
      address: string; // token contract
      to_address: string;
      value?: string;
      value_decimal?: string;
      block_timestamp?: string;
    }>;
  };

  const out: Transfer[] = [];
  for (const t of json.result ?? []) {
    if ((t.address ?? "").toLowerCase() !== USDT_CONTRACT.toLowerCase()) continue;
    if ((t.to_address ?? "").toLowerCase() !== address.toLowerCase()) continue;
    if (t.block_timestamp) {
      const ageMs = Date.now() - new Date(t.block_timestamp).getTime();
      if (Number.isFinite(ageMs) && ageMs > MAX_DEPOSIT_AGE_MS) continue;
    }
    const amount =
      t.value_decimal != null
        ? parseFloat(t.value_decimal)
        : Number(BigInt(t.value ?? "0")) / Math.pow(10, USDT_DECIMALS);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    out.push({ txHash: t.transaction_hash, amount });
  }
  return out;
}

export async function POST() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ success: false, message: "Profile not found" }, { status: 404 });
  }

  // Allow brisk polling from the deposit page, but cap abuse.
  if (!await rateLimit(`check-deposits:${profile.id}`, 12, 60_000)) {
    return rateLimitResponse("Please wait a moment before checking again.");
  }

  const adminId = process.env.SYSTEM_ADMIN_PROFILE_ID;
  if (!adminId) {
    return NextResponse.json({ success: false, message: "Server misconfigured" }, { status: 500 });
  }

  let address: string;
  try {
    address = await getOrAssignDepositAddress(profile.id);
  } catch {
    return NextResponse.json({ success: false, message: "No deposit address" }, { status: 500 });
  }

  let credited = 0;
  try {
    const transfers = await fetchRecentTransfers(address);
    for (const t of transfers) {
      // Skip if already recorded (dedup by tx hash — also tombstones reversed ones)
      const { count } = await admin
        .from("deposits")
        .select("id", { count: "exact", head: true })
        .eq("tx_hash", t.txHash);
      if (count && count > 0) continue;

      const { data: dep, error: insErr } = await admin
        .from("deposits")
        .insert({
          profile_id: profile.id,
          asset_symbol: "USDT",
          network_name: "BNB Smart Chain (BEP-20)",
          amount_expected: t.amount,
          deposit_address: address,
          tx_hash: t.txHash,
          status: "pending",
        })
        .select("id")
        .single();
      if (insErr) {
        if (insErr.code !== "23505") console.error("[check-deposits] insert:", insErr.message);
        continue;
      }

      const { error: rpcErr } = await admin.rpc("approve_deposit", {
        p_deposit_id: dep.id,
        p_admin_profile_id: adminId,
        p_amount_received: t.amount,
        p_admin_notes: `Auto-credited via on-demand deposit check. txHash: ${t.txHash}`,
      });
      if (rpcErr) {
        console.error("[check-deposits] approve:", rpcErr.message);
        continue;
      }
      credited += 1;
    }
  } catch (err) {
    console.error("[check-deposits] error:", err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ success: true, credited });
}
