/** Mirrors PostgreSQL enums in docs/SCHEMA.sql */

export type AppRole = "user" | "promoter" | "admin";

export type ProfileStatus = "active" | "inactive" | "suspended";

export type PromoterStatus = "active" | "inactive" | "suspended";

export type WalletStatus = "active" | "locked" | "suspended";

export type WalletTxType =
  | "deposit"
  | "withdrawal"
  | "trade_debit"
  | "trade_credit"
  | "fee_debit"
  | "settlement_credit"
  | "settlement_debit"
  | "commission_credit"
  | "adjustment_credit"
  | "adjustment_debit";

export type EntryDirection = "credit" | "debit";

export type DepositStatus = "pending" | "approved" | "rejected" | "cancelled";

export type WithdrawalStatus = "pending" | "approved" | "rejected" | "cancelled";

/** Deposit UI / deposits.asset_symbol constraint */
export type DepositAssetSymbol = "BTC" | "USDT" | "USDC" | "BNB" | "SOL";

/** markets.asset_symbol constraint */
export type MarketAssetSymbol =
  | "BTC"
  | "ETH"
  | "SOL"
  | "BNB"
  | "USDT"
  | "USDC"
  | "XRP"
  | "ADA"
  | "DOGE";

export type MarketStatus = "draft" | "active" | "closed" | "settled" | "cancelled";

export type MarketOutcome = "yes" | "no" | "unresolved" | "cancelled";

export type TradeSide = "yes" | "no";

export type TradeStatus = "pending" | "executed" | "cancelled" | "settled";

export type PositionStatus = "open" | "settled" | "cancelled";

export type CommissionStatus = "pending" | "approved" | "paid" | "cancelled";

export type AdminActionType =
  | "deposit_approved"
  | "deposit_rejected"
  | "withdrawal_approved"
  | "withdrawal_rejected"
  | "market_created"
  | "market_updated"
  | "market_closed"
  | "market_settled"
  | "market_cancelled"
  | "commission_marked_paid"
  | "wallet_adjusted"
  | "user_updated"
  | "promoter_updated";
