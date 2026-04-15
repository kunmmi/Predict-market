import type { MarketAssetSymbol } from "@/types/enums";
import type { MarketOutcome } from "@/types/enums";
import type { MarketStatus } from "@/types/enums";

/** public.markets row */
export type MarketRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  asset_symbol: MarketAssetSymbol;
  question_text: string;
  rules_text: string | null;
  close_at: string;
  settle_at: string;
  status: MarketStatus;
  resolution_outcome: MarketOutcome;
  resolution_notes: string | null;
  created_by: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};
