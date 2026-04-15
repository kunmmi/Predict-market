import type { PromoterStatus } from "@/types/enums";

/** public.promoters row */
export type PromoterRow = {
  id: string;
  profile_id: string;
  display_name: string | null;
  promo_code: string;
  status: PromoterStatus;
  commission_rate: string;
  total_commission_generated: string;
  created_at: string;
  updated_at: string;
};
