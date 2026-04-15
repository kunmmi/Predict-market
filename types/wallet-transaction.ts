import type { EntryDirection } from "@/types/enums";
import type { WalletTxType } from "@/types/enums";

/** public.wallet_transactions row */
export type WalletTransactionRow = {
  id: string;
  wallet_id: string;
  profile_id: string;
  transaction_type: WalletTxType;
  reference_table: string | null;
  reference_id: string | null;
  asset_symbol: string;
  amount: string;
  direction: EntryDirection;
  balance_before: string;
  balance_after: string;
  description: string | null;
  created_at: string;
};
