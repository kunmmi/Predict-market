/**
 * Domain row types aligned with docs/SCHEMA.sql (snake_case for Supabase).
 * Blueprint → modules: profile, promoter, referral, wallet, deposit, market, trade, position, commission, admin.
 */

export type {
  AdminActionType,
  AppRole,
  CommissionStatus,
  DepositAssetSymbol,
  DepositStatus,
  EntryDirection,
  MarketAssetSymbol,
  MarketOutcome,
  MarketStatus,
  PositionStatus,
  ProfileStatus,
  PromoterStatus,
  TradeSide,
  TradeStatus,
  WalletStatus,
  WalletTxType,
} from "@/types/enums";

export type { AdminLogRow } from "@/types/admin-log";
export type { CommissionRow } from "@/types/commission";
export type { DepositRow } from "@/types/deposit";
export type { MarketPriceRow } from "@/types/market-price";
export type { MarketRow } from "@/types/market";
export type { PositionRow } from "@/types/position";
export type { ProfileRow } from "@/types/profile";
export type { PromoterRow } from "@/types/promoter";
export type { ReferralRow } from "@/types/referral";
export type { TradeRow } from "@/types/trade";
export type { WalletRow } from "@/types/wallet";
export type { WalletTransactionRow } from "@/types/wallet-transaction";
