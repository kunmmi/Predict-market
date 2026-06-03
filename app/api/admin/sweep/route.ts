/**
 * GET  /api/admin/sweep  — dry-run preview (no transactions)
 * POST /api/admin/sweep  — execute consolidation sweep
 *
 * Consolidates USDT from all per-user deposit addresses into the master wallet.
 *
 * First-time addresses are initialised automatically:
 *   1. Master wallet sends ~0.0005 BNB to the deposit address.
 *   2. Deposit address calls USDT.approve(masterAddress, MaxUint256).
 *   3. DB is updated with sweep_approved_at.
 *
 * Subsequent calls for already-approved addresses skip steps 1–2 and go
 * straight to transferFrom — no BNB is ever sent to those addresses again.
 *
 * Processing is sequential (one address at a time) to avoid nonce collisions
 * on the master wallet. Large fleets may take a few minutes — maxDuration is
 * set to 300 s (requires Vercel Pro / Edge Functions).
 */

import { NextResponse } from "next/server";

import { requireAdminForApi } from "@/lib/auth/require-admin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createProvider,
  getMasterWallet,
  previewAddresses,
} from "@/lib/blockchain/bsc-sweep";
import { runSweep } from "@/lib/services/run-sweep";

export const dynamic    = "force-dynamic";
export const maxDuration = 60; // seconds — max on Vercel Hobby plan

// ── GET — preview ──────────────────────────────────────────────────────────

export async function GET() {
  try {
    await requireAdminForApi();
  } catch {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const supabase  = createSupabaseAdminClient();
  const provider  = createProvider();

  const { data: walletRows } = await supabase
    .from("wallets")
    .select("profile_id, deposit_address, deposit_address_index, sweep_approved_at");

  const eligible = (walletRows ?? []).filter(
    (w): w is typeof w & { deposit_address: string } =>
      typeof w.deposit_address === "string" && w.deposit_address !== "",
  );

  if (!eligible.length) {
    return NextResponse.json({
      success: true,
      masterAddress: getMasterWallet().address,
      total: 0,
      toSweep: 0,
      needsInit: 0,
      totalPendingUsdt: "0.00",
      addresses: [],
    });
  }

  try {
    const preview = await previewAddresses(
      eligible.map((w) => ({
        profile_id: w.profile_id as string,
        deposit_address: w.deposit_address,
        deposit_address_index: w.deposit_address_index as number | null,
      })),
      provider,
    );

    const toSweep   = preview.addresses.filter((a) => a.wouldSweep);
    const needsInit = toSweep.filter((a) => !a.approved);

    return NextResponse.json({
      success: true,
      masterAddress: preview.masterAddress,
      total: preview.addresses.length,
      toSweep: toSweep.length,
      needsInit: needsInit.length,
      totalPendingUsdt: preview.totalPendingUsdt,
      addresses: preview.addresses,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

// ── POST — execute ─────────────────────────────────────────────────────────

export async function POST() {
  try {
    await requireAdminForApi();
  } catch {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  try {
    const result = await runSweep("admin");
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
