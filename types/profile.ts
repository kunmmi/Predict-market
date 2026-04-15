import type { AppRole, ProfileStatus } from "@/types/enums";

/** public.profiles row (snake_case to match Supabase) */
export type ProfileRow = {
  id: string;
  auth_user_id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  status: ProfileStatus;
  referred_by_promoter_id: string | null;
  created_at: string;
  updated_at: string;
};
