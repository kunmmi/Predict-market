/**
 * Maps each supported deposit asset to the platform's receiving address
 * and the Tatum chain identifier used in webhook payloads.
 *
 * SERVER-ONLY — reads process.env directly. Never import this in client components.
 * Client components should use GET /api/config/deposit-addresses instead.
 */

import type { DepositAssetSymbol } from "@/types/enums";

export type AssetAddressConfig = {
  /** Platform wallet address for this asset, or null if not configured. */
  address: string | null;
  /** Tatum chain string as it appears in webhook payloads (e.g. "BTC", "ETH", "BSC", "SOL"). */
  tatumChain: string;
  /** Human-readable network name shown in the UI. */
  networkLabel: string;
};

export const ASSET_ADDRESS_CONFIG: Record<DepositAssetSymbol, AssetAddressConfig> = {
  // Active: USDT on BNB Smart Chain (BEP-20) — single chain for launch.
  // Other chains are configured below but not shown in the UI yet.
  USDT: {
    address: process.env.DEPOSIT_ADDRESS_BSC ?? null,
    tatumChain: "BSC",
    networkLabel: "BNB Smart Chain (BEP-20)",
  },
  // Not yet active in the UI — kept for future expansion.
  BTC: {
    address: process.env.DEPOSIT_ADDRESS_BTC ?? null,
    tatumChain: "BTC",
    networkLabel: "Bitcoin",
  },
  USDC: {
    address: process.env.DEPOSIT_ADDRESS_ETH ?? null,
    tatumChain: "ETH",
    networkLabel: "Ethereum (ERC-20)",
  },
  BNB: {
    address: process.env.DEPOSIT_ADDRESS_BSC ?? null,
    tatumChain: "BSC",
    networkLabel: "BNB Smart Chain",
  },
  SOL: {
    address: process.env.DEPOSIT_ADDRESS_SOL ?? null,
    tatumChain: "SOL",
    networkLabel: "Solana",
  },
};

/**
 * Returns the platform deposit address for a given asset, or null if not configured.
 */
export function getDepositAddress(asset: DepositAssetSymbol): string | null {
  return ASSET_ADDRESS_CONFIG[asset]?.address ?? null;
}

/**
 * Maps a Tatum chain + optional tokenSymbol back to our DepositAssetSymbol.
 * Returns null if the combination is not supported.
 */
export function resolveAssetSymbol(
  chain: string,
  tokenSymbol?: string | null,
): DepositAssetSymbol | null {
  if (chain === "BTC") return "BTC";
  if (chain === "SOL" && !tokenSymbol) return "SOL";
  if (chain === "BSC" && !tokenSymbol) return "BNB";

  const token = tokenSymbol?.toUpperCase();
  if (token === "USDT") return "USDT";
  if (token === "USDC") return "USDC";
  if (token === "BNB") return "BNB";

  return null;
}
