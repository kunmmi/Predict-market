/**
 * Crypto logo URLs served from jsDelivr CDN (cryptocurrency-icons package).
 * Supports BTC, ETH, BNB, SOL, XRP, DOGE and many more — all lowercase symbols.
 *
 * Usage: <CryptoIcon symbol="BTC" size={32} />
 */

const BASE =
  "https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa/128/color";

/** Returns the icon URL for a given asset symbol (e.g. "BTC" → URL). */
export function cryptoIconUrl(symbol: string): string {
  return `${BASE}/${symbol.toLowerCase()}.png`;
}

/** Returns true if the symbol is likely to have a colour icon in the package. */
export function hasCryptoIcon(symbol: string): boolean {
  const known = new Set([
    "btc", "eth", "bnb", "sol", "xrp", "doge", "ada", "dot", "avax",
    "matic", "link", "ltc", "bch", "xlm", "trx", "etc", "atom", "near",
    "ftm", "algo", "icp", "hbar", "egld", "vet", "sand", "mana", "axs",
    "theta", "fil", "hnt", "klay", "cake", "one", "zec", "dash",
  ]);
  return known.has(symbol.toLowerCase());
}
