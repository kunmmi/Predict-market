/**
 * Maps asset symbols (as stored in the markets table) to Binance ticker symbols.
 * Used when fetching live spot prices for short-duration market creation and settlement.
 */
export const ASSET_TO_BINANCE: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
  BNB: "BNBUSDT",
  XRP: "XRPUSDT",
  ADA: "ADAUSDT",
  DOGE: "DOGEUSDT",
};
