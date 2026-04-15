import type { TradeSide } from "@/types/enums";
import type { TradeStatus } from "@/types/enums";

/** public.trades row */
export type TradeRow = {
  id: string;
  profile_id: string;
  market_id: string;
  side: TradeSide;
  amount: string;
  price: string;
  fee_amount: string;
  position_units: string;
  status: TradeStatus;
  created_at: string;
  settled_at: string | null;
};
