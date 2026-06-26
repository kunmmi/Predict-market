"use client";

import { createBrowserClient } from "@supabase/ssr";

import { config } from "@/lib/config";

/**
 * Authenticated browser Supabase client.
 *
 * Unlike `lib/supabase/client.ts` (a plain anon client), this reads the logged-in
 * user's session from the same cookies `@supabase/ssr` writes server-side. That
 * means `auth.uid()` is populated, so RLS-gated SELECTs work AND Realtime
 * subscriptions are authenticated — each subscriber only receives the rows their
 * RLS policies allow. Use this for client-side reads and Realtime.
 */
let cached: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (cached) return cached;
  cached = createBrowserClient(config.supabase.url(), config.supabase.anonKey());
  return cached;
}
