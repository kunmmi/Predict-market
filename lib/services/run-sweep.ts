/**
 * Core sweep execution logic — shared by:
 *   • POST /api/admin/sweep       (manual, admin-triggered)
 *   • POST /api/cron/sweep        (automated, Vercel Cron)
 *
 * Consolidates USDT from every user deposit address into the master wallet,
 * sweeping only the platform-earned amount (fees + loser stakes) per user:
 *
 *   sweepable = on-chain deposit balance − user's internal platform balance
 *
 * This ensures we never touch funds that still belong to users.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createProvider,
  getMasterWallet,
  previewAddresses,
  initializeDepositAddress,
  sweepDepositAddress,
  MIN_SWEEP_AMOUNT,
  USDT_DECIMALS,
  getUsdtAllowance,
} from "@/lib/blockchain/bsc-sweep";
import { ethers } from "ethers";

export type SweepEntry = {
  address:   string;
  profileId: string;
  action:    "skip" | "init" | "sweep" | "init+sweep";
  status:    "ok" | "error" | "skipped";
  detail?:   string;
  txHash?:   string;
  bnbTxHash?: string;
  amountUsdt?: string;
};

export type SweepResult = {
  success: boolean;
  summary: {
    swept:           number;
    errored:         number;
    skipped:         number;
    totalSweptUsdt:  string;
    masterAddress:   string;
    triggeredBy:     "admin" | "cron";
  };
  results: SweepEntry[];
  error?:  string;
};

export async function runSweep(
  triggeredBy: "admin" | "cron" = "admin",
): Promise<SweepResult> {
  const supabase = createSupabaseAdminClient();
  const provider = createProvider();
  const master   = getMasterWallet(provider);

  const { data: walletRows } = await supabase
    .from("wallets")
    .select("profile_id, deposit_address, deposit_address_index, sweep_approved_at, balance");

  const eligible = (walletRows ?? []).filter(
    (w): w is typeof w & { deposit_address: string } =>
      typeof w.deposit_address === "string" && w.deposit_address !== "",
  );

  const results: SweepEntry[] = [];
  let totalSweptUsdt = 0;

  for (const w of eligible) {
    const addr  = w.deposit_address;
    const index = w.deposit_address_index as number | null;

    const userPlatformBalance = parseFloat(String(w.balance ?? "0"));

    const entry: SweepEntry = {
      address:   addr,
      profileId: w.profile_id as string,
      action:    "skip",
      status:    "skipped",
    };

    try {
      const { addresses: [preview] } = await previewAddresses(
        [{ profile_id: w.profile_id as string, deposit_address: addr, deposit_address_index: index }],
        provider,
      );

      const onChainBalance = parseFloat(preview?.usdtBalance ?? "0");
      const sweepableUsdt  = Math.max(0, onChainBalance - userPlatformBalance);

      if (sweepableUsdt < 1) {
        entry.detail = `Nothing to sweep (on-chain $${onChainBalance.toFixed(2)}, user balance $${userPlatformBalance.toFixed(2)})`;
        results.push(entry);
        continue;
      }

      const sweepableCap = ethers.parseUnits(sweepableUsdt.toFixed(6), USDT_DECIMALS);

      const allowance = await getUsdtAllowance(addr, master.address, provider);
      const needsInit = allowance < MIN_SWEEP_AMOUNT;

      if (needsInit) {
        if (index === null) {
          entry.action = "skip";
          entry.status = "error";
          entry.detail = "deposit_address_index is null — cannot derive private key.";
          results.push(entry);
          continue;
        }

        entry.action = "init+sweep";

        const initResult = await initializeDepositAddress(addr, index, provider);
        if (initResult.status === "initialized") {
          entry.bnbTxHash = initResult.bnbTxHash;
          await supabase
            .from("wallets")
            .update({ sweep_approved_at: new Date().toISOString() })
            .eq("deposit_address", addr);
        }
      } else {
        entry.action = "sweep";
      }

      const sweepResult = await sweepDepositAddress(addr, provider, sweepableCap);

      if (sweepResult.status === "swept") {
        entry.status     = "ok";
        entry.txHash     = sweepResult.txHash;
        entry.amountUsdt = sweepResult.amountUsdt;
        totalSweptUsdt  += parseFloat(sweepResult.amountUsdt);

        await supabase.from("admin_logs").insert({
          action_type:  "usdt_sweep",
          target_table: "wallets",
          target_id:    w.profile_id as string,
          notes:        `[${triggeredBy}] Swept ${sweepResult.amountUsdt} USDT from ${addr} → ${master.address}. TX: ${sweepResult.txHash}`,
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

  return {
    success: true,
    summary: {
      swept,
      errored,
      skipped,
      totalSweptUsdt: totalSweptUsdt.toFixed(2),
      masterAddress:  master.address,
      triggeredBy,
    },
    results,
  };
}
