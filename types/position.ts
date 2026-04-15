import type { PositionStatus } from "@/types/enums";

/** public.positions row */
export type PositionRow = {
  id: string;
  profile_id: string;
  market_id: string;
  yes_units: string;
  no_units: string;
  avg_yes_price: string | null;
  avg_no_price: string | null;
  status: PositionStatus;
  pnl_amount: string;
  created_at: string;
  updated_at: string;
};
