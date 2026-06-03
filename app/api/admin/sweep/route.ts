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
  initializeDepositAddress,
  sweepDepositAddress,
  MIN_SWEEP_AMOUNT,
  getUsdtAllowance,
} from "@/lib/blockchain/bsc-sweep";
import { ethers } from "ethers";

export const dynamic    = "force-dynamic";
export const maxDuration = 300; // seconds (Vercel Pro)

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

type SweepEntry = {
  address: string;
  profileId: string;
  action: "skip" | "init" | "sweep" | "init+sweep";
  status: "ok" | "error" | "skipped";
  detail?: string;
  txHash?: string;
  bnbTxHash?: string;
  amountUsdt?: string;
};

export async function POST() {
  try {
    await requireAdminForApi();
  } catch {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const provider = createProvider();
  const master   = getMasterWallet(provider);

  const { data: walletRows } = await supabase
    .from("wallets")
    .select("profile_id, deposit_address, deposit_address_index, sweep_approved_at");

  const eligible = (walletRows ?? []).filter(
    (w): w is typeof w & { deposit_address: string } =>
      typeof w.deposit_address === "string" && w.deposit_address !== "",
  );

  const results: SweepEntry[] = [];
  let totalSweptUsdt = 0;

  // Process sequentially — master wallet can't sign two txs at the same time
  // without explicit nonce management; sequential is simpler and safe.
  for (const w of eligible) {
    const addr  = w.deposit_address;
    const index = w.deposit_address_index as number | null;

    const entry: SweepEntry = {
      address:   addr,
      profileId: w.profile_id as string,
      action:    "skip",
      status:    "skipped",
    };

    try {
      // ── Check if there's USDT worth sweeping ───────────────────────────
      const { addresses: [preview] } = await previewAddresses(
        [{ profile_id: w.profile_id as string, deposit_address: addr, deposit_address_index: index }],
        provider,
      );

      if (!preview || !preview.wouldSweep) {
        entry.detail = `Balance $${preview?.usdtBalance ?? "0"} — below minimum`;
        results.push(entry);
        continue;
      }

      // ── Initialize if needed (one-time) ───────────────────────────────
      const allowance = await getUsdtAllowance(addr, master.address, provider);
      const needsInit = allowance < MIN_SWEEP_AMOUNT;

      if (needsInit) {
        if (index === null) {
          entry.action = "skip";
          entry.status = "error";
          entry.detail = "deposit_address_index is null — cannot derive private key. Assign index and retry.";
          results.push(entry);
          continue;
        }

        entry.action = "init+sweep";

        const initResult = await initializeDepositAddress(addr, index, provider);

        if (initResult.status === "initialized") {
          entry.bnbTxHash = initResult.bnbTxHash;
          // Mark as approved in DB
          await supabase
            .from("wallets")
            .update({ sweep_approved_at: new Date().toISOString() })
            .eq("deposit_address", addr);
        }
      } else {
        entry.action = "sweep";
      }

      // ── Sweep ──────────────────────────────────────────────────────────
      const sweepResult = await sweepDepositAddress(addr, provider);

      if (sweepResult.status === "swept") {
        entry.status    = "ok";
        entry.txHash    = sweepResult.txHash;
        entry.amountUsdt = sweepResult.amountUsdt;
        totalSweptUsdt  += parseFloat(sweepResult.amountUsdt);

        // Log to admin_logs
        await supabase.from("admin_logs").insert({
          action_type:  "usdt_sweep",
          target_table: "wallets",
          target_id:    w.profile_id as string,
          notes:        `Swept ${sweepResult.amountUsdt} USDT from ${addr} → ${master.address}. TX: ${sweepResult.txHash}`,
        });
      } else {
        entry.status = "error";
        entry.detail = sweepResult.status;
      }
    } catch (err) {
      entry.action = entry.action === "skip" ? "sweep" : entry.action;
      entry.status = "error";
      entry.detail = err instanceof Error ? err.message : String(err);
    }

    results.push(entry);
  }

  const swept   = results.filter((r) => r.status === "ok").length;
  const errored = results.filter((r) => r.status === "error").length;
  const skipped = results.filter((r) => r.status === "skipped").length;

  return NextResponse.json({
    success: true,
    summary: {
      swept,
      errored,
      skipped,
      totalSweptUsdt: totalSweptUsdt.toFixed(2),
      masterAddress: master.address,
    },
    results,
  });
}
