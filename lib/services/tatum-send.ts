/**
 * Outgoing crypto transaction service.
 *
 * Sends BEP-20 USDT/USDC on BSC directly via ethers.js — no Tatum plan required.
 * Native coin senders (ETH, BNB, SOL) are kept for future use.
 *
 * Required env vars:
 *   WALLET_PRIVATE_KEY_ETH  — hex private key for the BSC/ETH platform wallet
 *   WALLET_PRIVATE_KEY_SOL  — base58 private key for the SOL platform wallet
 */

import { ethers } from "ethers";

// ---------------------------------------------------------------------------
// BEP-20 / ERC-20 minimal ABI (transfer only)
// ---------------------------------------------------------------------------

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
];

// ---------------------------------------------------------------------------
// Token contract addresses
// ---------------------------------------------------------------------------

const TOKEN_CONTRACTS = {
  ETH: {
    USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
    USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
  },
  BSC: {
    USDT: { address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
    USDC: { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
  },
};

// ---------------------------------------------------------------------------
// RPC endpoints (public, no API key needed)
// ---------------------------------------------------------------------------

const RPC = {
  BSC: "https://bsc-dataseed1.binance.org/",
  ETH: "https://eth.llamarpc.com",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing environment variable: ${key}`);
  return val;
}

// ---------------------------------------------------------------------------
// BEP-20 sender (ethers.js — direct BSC broadcast)
// ---------------------------------------------------------------------------

async function sendBep20(
  toAddress: string,
  amount: number,
  token: "USDT" | "USDC",
): Promise<string> {
  const contract = TOKEN_CONTRACTS.BSC[token];
  const provider = new ethers.JsonRpcProvider(RPC.BSC);
  const wallet = new ethers.Wallet(getEnv("WALLET_PRIVATE_KEY_ETH"), provider);
  const erc20 = new ethers.Contract(contract.address, ERC20_ABI, wallet);

  // Convert human-readable amount to token units (USDT BSC has 18 decimals)
  const amountUnits = ethers.parseUnits(
    parseFloat(amount.toFixed(8)).toString(),
    contract.decimals,
  );

  console.log("[tatum-send] sendBep20:", {
    token,
    to: toAddress,
    amount,
    amountUnits: amountUnits.toString(),
    contractAddress: contract.address,
  });

  const tx = await (erc20.transfer as (to: string, amount: bigint) => Promise<ethers.TransactionResponse>)(toAddress, amountUnits);
  console.log("[tatum-send] tx submitted:", tx.hash);

  // Wait for 1 confirmation
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) {
    throw new Error("Transaction was submitted but failed on-chain.");
  }

  console.log("[tatum-send] tx confirmed:", tx.hash);
  return tx.hash;
}

// ---------------------------------------------------------------------------
// ERC-20 sender (ethers.js — direct ETH broadcast)
// ---------------------------------------------------------------------------

async function sendErc20(
  toAddress: string,
  amount: number,
  token: "USDT" | "USDC",
): Promise<string> {
  const contract = TOKEN_CONTRACTS.ETH[token];
  const provider = new ethers.JsonRpcProvider(RPC.ETH);
  const wallet = new ethers.Wallet(getEnv("WALLET_PRIVATE_KEY_ETH"), provider);
  const erc20 = new ethers.Contract(contract.address, ERC20_ABI, wallet);

  const amountUnits = ethers.parseUnits(
    parseFloat(amount.toFixed(8)).toString(),
    contract.decimals,
  );

  const tx = await (erc20.transfer as (to: string, amount: bigint) => Promise<ethers.TransactionResponse>)(toAddress, amountUnits);
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) {
    throw new Error("Transaction was submitted but failed on-chain.");
  }
  return tx.hash;
}

// ---------------------------------------------------------------------------
// Native coin senders (kept for future use)
// ---------------------------------------------------------------------------

async function sendBnb(toAddress: string, amount: number): Promise<string> {
  const provider = new ethers.JsonRpcProvider(RPC.BSC);
  const wallet = new ethers.Wallet(getEnv("WALLET_PRIVATE_KEY_ETH"), provider);
  const tx = await wallet.sendTransaction({
    to: toAddress,
    value: ethers.parseEther(amount.toFixed(18)),
  });
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) {
    throw new Error("BNB transaction failed on-chain.");
  }
  return tx.hash;
}

async function sendEth(toAddress: string, amount: number): Promise<string> {
  const provider = new ethers.JsonRpcProvider(RPC.ETH);
  const wallet = new ethers.Wallet(getEnv("WALLET_PRIVATE_KEY_ETH"), provider);
  const tx = await wallet.sendTransaction({
    to: toAddress,
    value: ethers.parseEther(amount.toFixed(18)),
  });
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) {
    throw new Error("ETH transaction failed on-chain.");
  }
  return tx.hash;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type SendCryptoParams = {
  asset: "ETH" | "BNB" | "SOL" | "USDT" | "USDC";
  /** User-entered network hint — used to disambiguate USDT/USDC chain */
  networkName: string | null;
  toAddress: string;
  /** Crypto amount to send (already converted from USD by the caller) */
  cryptoAmount: number;
};

/**
 * Sends crypto from the platform wallet to the user's address.
 * BEP-20/ERC-20 tokens go via ethers.js directly — no Tatum plan required.
 * Returns the on-chain transaction hash on success.
 * Throws a descriptive Error on failure.
 */
export async function sendCrypto({
  asset,
  networkName,
  toAddress,
  cryptoAmount,
}: SendCryptoParams): Promise<string> {
  if (cryptoAmount <= 0) throw new Error("Crypto amount must be greater than zero.");

  const network = (networkName ?? "").toLowerCase();

  switch (asset) {
    case "ETH":
      return sendEth(toAddress, cryptoAmount);

    case "BNB":
      return sendBnb(toAddress, cryptoAmount);

    case "SOL":
      // SOL sending not yet implemented — kept for future expansion
      throw new Error("SOL withdrawals are not yet supported.");

    case "USDT":
    case "USDC": {
      const onBsc =
        network.includes("bsc") ||
        network.includes("bnb") ||
        network.includes("bep") ||
        network.includes("binance");

      if (onBsc) {
        return sendBep20(toAddress, cryptoAmount, asset);
      } else {
        return sendErc20(toAddress, cryptoAmount, asset);
      }
    }

    default:
      throw new Error(`Unsupported asset: ${asset}`);
  }
}
