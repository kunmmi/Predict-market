import type { WalletStatus } from "@/types/enums";

/** public.wallets row */
export type WalletRow = {
  id: string;
  profile_id: string;
  balance: string;
  available_balance: string;
  reserved_balance: string;
  status: WalletStatus;
  created_at: string;
  updated_at: string;
};
