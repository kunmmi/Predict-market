import { createClient } from "@supabase/supabase-js";

import { config } from "@/lib/config";

export function createSupabaseAdminClient() {
  const serviceRoleKey = config.supabase.serviceRoleKey();
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for admin operations.");
  }

  return createClient(config.supabase.url(), serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
