import type { DepositAssetSymbol } from "@/types/enums";
import type { DepositStatus } from "@/types/enums";

/** public.deposits row */
export type DepositRow = {
  id: string;
  profile_id: string;
  asset_symbol: DepositAssetSymbol;
  network_name: string | null;
  amount_expected: string | null;
  amount_received: string | null;
  tx_hash: string | null;
  deposit_address: string | null;
  status: DepositStatus;
  admin_reviewed_by: string | null;
  admin_notes: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
};
