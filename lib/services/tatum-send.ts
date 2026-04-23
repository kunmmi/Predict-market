/**
 * Tatum v3 REST API wrapper for sending outgoing crypto transactions.
 *
 * Supported:
 *   - ETH  (native, Ethereum)
 *   - BNB  (native, BNB Smart Chain)
 *   - SOL  (native, Solana)
 *   - USDT (ERC-20 on ETH  | BEP-20 on BSC)
 *   - USDC (ERC-20 on ETH  | BEP-20 on BSC)
 *
 * Private keys are read exclusively from environment variables — they are
 * never logged or returned to callers.
 */

const TATUM_BASE = "https://api.tatum.io/v3";

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
// Helpers
// ---------------------------------------------------------------------------

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing environment variable: ${key}`);
  return val;
}

async function tatumPost(path: string, body: Record<string, unknown>): Promise<{ txId: string }> {
  const apiKey = getEnv("TATUM_API_KEY");

  const res = await fetch(`${TATUM_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;

  if (!res.ok) {
    const message =
      (json?.message as string) ??
      (json?.error as string) ??
      `Tatum API error ${res.status}`;
    console.error("[tatum-send] API error:", res.status, JSON.stringify(json));
    throw new Error(message);
  }

  const txId = (json?.txId ?? json?.hash ?? json?.id) as string | undefined;
  if (!txId) throw new Error("Tatum did not return a transaction ID.");
  return { txId };
}

// ---------------------------------------------------------------------------
// Native coin senders
// ---------------------------------------------------------------------------

async function sendEth(toAddress: string, amount: number): Promise<string> {
  const { txId } = await tatumPost("/ethereum/transaction", {
    fromPrivateKey: getEnv("WALLET_PRIVATE_KEY_ETH"),
    to: toAddress,
    amount: amount.toFixed(18),
  });
  return txId;
}

async function sendBnb(toAddress: string, amount: number): Promise<string> {
  const { txId } = await tatumPost("/bsc/transaction", {
    fromPrivateKey: getEnv("WALLET_PRIVATE_KEY_ETH"), // same key — ETH & BSC share address
    to: toAddress,
    amount: amount.toFixed(18),
    currency: "BNB",
  });
  return txId;
}

async function sendSol(toAddress: string, amount: number): Promise<string> {
  const fromAddress = getEnv("DEPOSIT_ADDRESS_SOL");
  const { txId } = await tatumPost("/solana/transaction", {
    from: fromAddress,
    to: toAddress,
    amount: amount.toFixed(9),
    fromPrivateKey: getEnv("WALLET_PRIVATE_KEY_SOL"),
  });
  return txId;
}

// ---------------------------------------------------------------------------
// ERC-20 / BEP-20 token senders
// ---------------------------------------------------------------------------

async function sendErc20(
  toAddress: string,
  amount: number,
  token: "USDT" | "USDC",
): Promise<string> {
  const contract = TOKEN_CONTRACTS.ETH[token];
  const { txId } = await tatumPost("/ethereum/erc20/transaction", {
    fromPrivateKey: getEnv("WALLET_PRIVATE_KEY_ETH"),
    to: toAddress,
    amount: amount.toFixed(contract.decimals),
    contractAddress: contract.address,
    digits: contract.decimals,
  });
  return txId;
}

async function sendBep20(
  toAddress: string,
  amount: number,
  token: "USDT" | "USDC",
): Promise<string> {
  const contract = TOKEN_CONTRACTS.BSC[token];
  // Use 8 significant decimal places — Tatum chokes on 18-digit strings
  const amountStr = parseFloat(amount.toFixed(8)).toString();
  console.log("[tatum-send] sendBep20 request:", {
    to: toAddress,
    amount: amountStr,
    contractAddress: contract.address,
    digits: contract.decimals,
  });
  const { txId } = await tatumPost("/bsc/bep20/transaction", {
    fromPrivateKey: getEnv("WALLET_PRIVATE_KEY_ETH"),
    to: toAddress,
    amount: amountStr,
    contractAddress: contract.address,
    digits: contract.decimals,
    feeCurrency: "BSC",
  });
  return txId;
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
 * Sends crypto from the platform wallet to the user's address via Tatum.
 * Returns the on-chain transaction hash/ID on success.
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
      return sendSol(toAddress, cryptoAmount);

    case "USDT":
    case "USDC": {
      // Decide chain from network hint — default to ETH if unclear
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
