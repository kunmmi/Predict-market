/**
 * BSC on-chain USDT consolidation sweep.
 *
 * Pattern: approve / transferFrom — deposit addresses never need BNB after setup.
 *
 *   First time per address:
 *     1. Master wallet sends ~0.0005 BNB to the deposit address (covers the approve tx gas).
 *     2. Deposit address private key is derived in-memory and used to call
 *        USDT.approve(masterAddress, MaxUint256) — once, forever.
 *
 *   Every sweep thereafter:
 *     Master wallet calls USDT.transferFrom(depositAddress, masterAddress, balance).
 *     No BNB ever touches the deposit address again.
 *
 * Address derivation:
 *   DEPOSIT_WALLET_XPUB  = public node at m/0  (used for address derivation — no private key)
 *   DEPOSIT_WALLET_MNEMONIC = full seed phrase
 *     → deposit address[i]  = mnemonic → root → deriveChild(0) → deriveChild(i)
 *     → master wallet        = mnemonic → root                  (path m, distinct address)
 *
 * SECURITY:
 *   - DEPOSIT_WALLET_MNEMONIC is never logged or stored.
 *   - Private keys are derived in-memory only, used to sign one tx, then discarded.
 *   - All functions are server-only; import only from admin-gated API routes.
 */

import { ethers, HDNodeWallet, Mnemonic } from "ethers";

// ── Constants ──────────────────────────────────────────────────────────────

export const USDT_CONTRACT  = "0x55d398326f99059fF775485246999027B3197955";
export const USDT_DECIMALS  = 18;

/** Minimum USDT balance worth sweeping — avoids burning gas for dust. */
export const MIN_SWEEP_AMOUNT = ethers.parseUnits("0.10", USDT_DECIMALS); // $0.10

/**
 * BNB sent to each deposit address exactly once to fund the approve() call.
 * A BSC approve tx uses ~46 000 gas × 1–3 Gwei ≈ 0.00014 BNB ≈ $0.07.
 * Sending 0.0003 BNB ≈ $0.20 covers gas with a comfortable buffer.
 */
export const BNB_FOR_APPROVE = ethers.parseEther("0.0003");

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
];

export const BSC_RPCS = [
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.binance.org",
  "https://bsc-dataseed2.binance.org",
  "https://bsc-dataseed1.ninicoin.io",
  "https://bsc-dataseed2.defibit.io",
];

// ── Provider ───────────────────────────────────────────────────────────────

/**
 * Returns a FallbackProvider across all public BSC RPC endpoints.
 * If the first RPC fails or rate-limits, ethers automatically retries the others.
 */
export function createProvider(): ethers.FallbackProvider {
  const providers = BSC_RPCS.map(
    (url, i) => ({ provider: new ethers.JsonRpcProvider(url), priority: i + 1, stallTimeout: 2000 })
  );
  return new ethers.FallbackProvider(providers, 56 /* BSC chainId */);
}

// ── Wallet helpers ─────────────────────────────────────────────────────────

function requireMnemonic(): string {
  const m = process.env.DEPOSIT_WALLET_MNEMONIC?.trim();
  if (!m) throw new Error("DEPOSIT_WALLET_MNEMONIC is not configured.");
  return m;
}

/**
 * Master wallet — the HD root (path m/).
 * Its address is distinct from all deposit addresses (m/0/<n>).
 * This wallet holds BNB for gas and receives all consolidated USDT.
 */
export function getMasterWallet(provider?: ethers.Provider): HDNodeWallet {
  const root = HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(requireMnemonic()));
  return (provider ? root.connect(provider) : root) as HDNodeWallet;
}

/**
 * Deposit address wallet at derivation index `index` (path m/0/<index>).
 * Private key derived on-demand — only needed to sign the one-time approve().
 */
export function getDepositWallet(index: number, provider?: ethers.Provider): HDNodeWallet {
  const root = HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(requireMnemonic()));
  const wallet = root.deriveChild(0).deriveChild(index);
  return (provider ? wallet.connect(provider) : wallet) as HDNodeWallet;
}

// ── On-chain read helpers ──────────────────────────────────────────────────

export async function getUsdtBalance(
  address: string,
  provider: ethers.Provider,
): Promise<bigint> {
  const usdt = new ethers.Contract(USDT_CONTRACT, ERC20_ABI, provider);
  return (usdt.balanceOf as (a: string) => Promise<bigint>)(address);
}

export async function getUsdtAllowance(
  owner: string,
  spender: string,
  provider: ethers.Provider,
): Promise<bigint> {
  const usdt = new ethers.Contract(USDT_CONTRACT, ERC20_ABI, provider);
  return (usdt.allowance as (o: string, s: string) => Promise<bigint>)(owner, spender);
}

export async function getBnbBalance(
  address: string,
  provider: ethers.Provider,
): Promise<bigint> {
  return provider.getBalance(address);
}

// ── Step 1: Initialize a deposit address (one-time) ───────────────────────

export type InitResult =
  | { status: "already_approved" }
  | { status: "initialized"; bnbTxHash: string; approveTxHash: string };

/**
 * Sets up a deposit address for gasless sweeping:
 *   1. Sends BNB_FOR_APPROVE from master wallet to the deposit address.
 *   2. Uses the deposit address private key to call USDT.approve(master, MaxUint256).
 *
 * Safe to call if already approved — returns early without sending anything.
 */
export async function initializeDepositAddress(
  depositAddress: string,
  depositIndex: number,
  provider: ethers.Provider,
): Promise<InitResult> {
  const master = getMasterWallet(provider);

  // Already approved? Skip entirely.
  const existing = await getUsdtAllowance(depositAddress, master.address, provider);
  if (existing >= MIN_SWEEP_AMOUNT) {
    return { status: "already_approved" };
  }

  // 1. Fund the deposit address with BNB so it can pay approve() gas.
  const fundTx = await master.sendTransaction({
    to: depositAddress,
    value: BNB_FOR_APPROVE,
  });
  const fundReceipt = await fundTx.wait(1);
  if (!fundReceipt || fundReceipt.status !== 1) {
    throw new Error(`BNB funding tx failed: ${fundTx.hash}`);
  }

  // 2. Approve master wallet from the deposit address.
  const depositWallet = getDepositWallet(depositIndex, provider);
  const usdt = new ethers.Contract(USDT_CONTRACT, ERC20_ABI, depositWallet);
  const approveTx = await (
    usdt.approve as (spender: string, amount: bigint) => Promise<ethers.TransactionResponse>
  )(master.address, ethers.MaxUint256);

  const approveReceipt = await approveTx.wait(1);
  if (!approveReceipt || approveReceipt.status !== 1) {
    throw new Error(`Approve tx failed: ${approveTx.hash}`);
  }

  return {
    status: "initialized",
    bnbTxHash: fundTx.hash,
    approveTxHash: approveTx.hash,
  };
}

// ── Step 2: Sweep a deposit address ───────────────────────────────────────

export type SweepResult =
  | { status: "swept";          txHash: string; amountUsdt: string }
  | { status: "zero_balance" }
  | { status: "below_minimum";  balanceUsdt: string }
  | { status: "not_approved" };

/**
 * Pulls USDT from depositAddress into masterWallet via transferFrom.
 * Requires the deposit address to have previously approved the master wallet.
 *
 * @param maxAmount - Optional cap in raw USDT units (bigint). When provided,
 *   only `min(balance, maxAmount)` is swept — so we never take more than the
 *   platform has legitimately earned (fees + loser stakes).
 */
export async function sweepDepositAddress(
  depositAddress: string,
  provider: ethers.Provider,
  maxAmount?: bigint,
): Promise<SweepResult> {
  const master = getMasterWallet(provider);

  const balance = await getUsdtBalance(depositAddress, provider);
  if (balance === BigInt(0)) return { status: "zero_balance" };
  if (balance < MIN_SWEEP_AMOUNT) {
    return { status: "below_minimum", balanceUsdt: ethers.formatUnits(balance, USDT_DECIMALS) };
  }

  // Cap to platform-earned quota if provided — never sweep user funds.
  const sweepAmount = maxAmount !== undefined && maxAmount < balance ? maxAmount : balance;
  if (sweepAmount < MIN_SWEEP_AMOUNT) {
    return { status: "below_minimum", balanceUsdt: ethers.formatUnits(sweepAmount, USDT_DECIMALS) };
  }

  const allowance = await getUsdtAllowance(depositAddress, master.address, provider);
  if (allowance < sweepAmount) return { status: "not_approved" };

  const usdt = new ethers.Contract(USDT_CONTRACT, ERC20_ABI, master);
  const tx = await (
    usdt.transferFrom as (
      from: string, to: string, amount: bigint
    ) => Promise<ethers.TransactionResponse>
  )(depositAddress, master.address, sweepAmount);

  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) {
    throw new Error(`transferFrom failed: ${tx.hash}`);
  }

  return {
    status: "swept",
    txHash: tx.hash,
    amountUsdt: ethers.formatUnits(sweepAmount, USDT_DECIMALS),
  };
}

// ── Direct withdrawal from deposit address ────────────────────────────────

export type DirectWithdrawResult =
  | { status: "sent"; txHash: string; amountUsdt: string; bnbTxHash?: string }
  | { status: "insufficient_deposit"; depositBalance: string; requested: string }
  | { status: "no_index" };

/**
 * Sends USDT directly from a user's deposit address to their requested
 * withdrawal address — bypassing the hot wallet entirely.
 *
 * Used as a fallback when the hot wallet has insufficient funds.
 *
 *   1. If not yet approved: master sends BNB → deposit address approves.
 *   2. Master calls transferFrom(depositAddress, toAddress, amount).
 *
 * @param amountRaw - Exact amount in raw USDT units (18 decimals) to send.
 */
export async function directWithdrawFromDepositAddress(
  depositAddress: string,
  depositIndex: number | null,
  toAddress: string,
  amountRaw: bigint,
  provider: ethers.Provider,
): Promise<DirectWithdrawResult> {
  const master = getMasterWallet(provider);

  // Verify deposit address has enough on-chain balance.
  const balance = await getUsdtBalance(depositAddress, provider);
  if (balance < amountRaw) {
    return {
      status: "insufficient_deposit",
      depositBalance: ethers.formatUnits(balance, USDT_DECIMALS),
      requested: ethers.formatUnits(amountRaw, USDT_DECIMALS),
    };
  }

  // Initialize (one-time approve) if the master wallet isn't approved yet.
  let bnbTxHash: string | undefined;
  const allowance = await getUsdtAllowance(depositAddress, master.address, provider);
  if (allowance < amountRaw) {
    if (depositIndex === null) return { status: "no_index" };
    const initResult = await initializeDepositAddress(depositAddress, depositIndex, provider);
    if (initResult.status === "initialized") {
      bnbTxHash = initResult.bnbTxHash;
    }
  }

  // transferFrom(depositAddress → user's destination) via master wallet.
  const usdt = new ethers.Contract(USDT_CONTRACT, ERC20_ABI, master);
  const tx = await (
    usdt.transferFrom as (
      from: string, to: string, amount: bigint
    ) => Promise<ethers.TransactionResponse>
  )(depositAddress, toAddress, amountRaw);

  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) {
    throw new Error(`Direct withdrawal transferFrom failed: ${tx.hash}`);
  }

  return {
    status: "sent",
    txHash: tx.hash,
    amountUsdt: ethers.formatUnits(amountRaw, USDT_DECIMALS),
    bnbTxHash,
  };
}

// ── Preview helper (no transactions) ──────────────────────────────────────

export type AddressPreview = {
  address: string;
  profileId: string;
  index: number | null;
  usdtBalance: string;       // raw on-chain balance
  sweepableBalance: string;  // on-chain minus user's platform balance (what platform can actually take)
  bnbBalance: string;
  approved: boolean;
  wouldSweep: boolean;
};

export async function previewAddresses(
  wallets: Array<{
    profile_id: string;
    deposit_address: string;
    deposit_address_index: number | null;
    userPlatformBalance?: number; // user's internal wallet balance — subtracted from sweepable
  }>,
  provider: ethers.Provider,
): Promise<{ masterAddress: string; addresses: AddressPreview[]; totalPendingUsdt: string }> {
  const master = getMasterWallet(provider);
  const masterAddress = master.address;

  const addresses = await Promise.all(
    wallets.map(async (w): Promise<AddressPreview> => {
      const addr = w.deposit_address;
      const [balance, allowance, bnb] = await Promise.all([
        getUsdtBalance(addr, provider),
        getUsdtAllowance(addr, masterAddress, provider),
        getBnbBalance(addr, provider),
      ]);

      const onChainFloat      = parseFloat(ethers.formatUnits(balance, USDT_DECIMALS));
      const userBalanceFloat  = w.userPlatformBalance ?? 0;
      const sweepableFloat    = Math.max(0, onChainFloat - userBalanceFloat);
      const sweepableRaw      = ethers.parseUnits(sweepableFloat.toFixed(6), USDT_DECIMALS);

      const approved   = allowance >= MIN_SWEEP_AMOUNT;
      const wouldSweep = sweepableRaw >= MIN_SWEEP_AMOUNT;

      return {
        address:         addr,
        profileId:       w.profile_id,
        index:           w.deposit_address_index,
        usdtBalance:     ethers.formatUnits(balance, USDT_DECIMALS),
        sweepableBalance: sweepableFloat.toFixed(6),
        bnbBalance:      ethers.formatEther(bnb),
        approved,
        wouldSweep,
      };
    }),
  );

  const totalPendingUsdt = addresses
    .filter((a) => a.wouldSweep)
    .reduce((s, a) => s + parseFloat(a.sweepableBalance), 0)
    .toFixed(2);

  return { masterAddress, addresses, totalPendingUsdt };
}
