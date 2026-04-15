import type { AdminActionType } from "@/types/enums";

/** public.admin_logs row */
export type AdminLogRow = {
  id: string;
  admin_profile_id: string;
  action_type: AdminActionType;
  target_table: string;
  target_id: string;
  notes: string | null;
  created_at: string;
};
