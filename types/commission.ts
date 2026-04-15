import type { CommissionStatus } from "@/types/enums";

/** public.commissions row */
export type CommissionRow = {
  id: string;
  promoter_id: string;
  referred_profile_id: string;
  trade_id: string;
  fee_amount_source: string;
  commission_rate: string;
  commission_amount: string;
  status: CommissionStatus;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};
