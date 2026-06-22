/**
 * On-chain deposit verification.
 *
 * SECURITY: Deposit webhooks (Moralis, Tatum) receive an HTTP POST claiming that
 * USDT arrived at one of our deposit addresses. The request body is fully
 * attacker-controllable — anyone who knows the endpoint URL can POST a fake
 * "you received 100000 USDT" payload. We therefore NEVER trust the amount (or
 * even the existence of the transfer) from the webhook body.
 *
 * Instead we look the transaction up by hash on the BSC chain itself, confirm it
 * succeeded, and sum the real USDT Transfer events whose recipient is the
 * expected deposit address. The amount we credit is the on-chain amount — not
 * anything the caller told us.
 */

import { ethers } from "ethers";
import { USDT_CONTRACT, USDT_DECIMALS, createProvider } from "./bsc-sweep";

// keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** Minimum confirmations before we trust a deposit. */
const MIN_CONFIRMATIONS = 1;

export type DepositVerification =
  | { ok: true; amount: number }
  | { ok: false; reason: string };

/**
 * Verify that `txHash` is a real, mined BSC transaction that transferred USDT
 * (BEP-20) to `expectedToAddress`. Returns the total on-chain USDT amount
 * received at that address in that transaction.
 *
 * Returns { ok: false } when the tx cannot be found, has not confirmed, failed,
 * or contains no matching USDT transfer — in every one of those cases the caller
 * must NOT credit anything.
 */
export async function verifyUsdtDeposit(
  txHash: string,
  expectedToAddress: string,
  provider?: ethers.Provider,
): Promise<DepositVerification> {
  if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return { ok: false, reason: "Malformed transaction hash" };
  }
  if (!ethers.isAddress(expectedToAddress)) {
    return { ok: false, reason: "Malformed recipient address" };
  }

  const p = provider ?? createProvider();

  let receipt: ethers.TransactionReceipt | null;
  try {
    receipt = await p.getTransactionReceipt(txHash);
  } catch (err) {
    return {
      ok: false,
      reason: `RPC error fetching receipt: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!receipt) {
    // Not mined / does not exist on-chain.
    return { ok: false, reason: "Transaction not found on-chain" };
  }
  if (receipt.status !== 1) {
    return { ok: false, reason: "Transaction reverted/failed on-chain" };
  }

  // Require the transaction to be sufficiently buried.
  try {
    const current = await p.getBlockNumber();
    const confirmations = current - receipt.blockNumber + 1;
    if (confirmations < MIN_CONFIRMATIONS) {
      return { ok: false, reason: `Only ${confirmations} confirmation(s)` };
    }
  } catch {
    // If we can't read the head, fail closed.
    return { ok: false, reason: "Could not determine confirmations" };
  }

  const usdt = USDT_CONTRACT.toLowerCase();
  const to = expectedToAddress.toLowerCase();
  const toTopic = ethers.zeroPadValue(to, 32).toLowerCase();

  let total = BigInt(0);
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== usdt) continue;
    if (log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;
    // topics[2] is the indexed `to` address.
    if (log.topics[2]?.toLowerCase() !== toTopic) continue;
    try {
      total += ethers.toBigInt(log.data);
    } catch {
      // Skip undecodable log rather than crediting it.
    }
  }

  if (total === BigInt(0)) {
    return { ok: false, reason: "No USDT transfer to expected address in tx" };
  }

  const amount = parseFloat(ethers.formatUnits(total, USDT_DECIMALS));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: "Non-positive on-chain amount" };
  }

  return { ok: true, amount };
}
