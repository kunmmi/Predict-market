"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Authenticated browser Supabase client.
 *
 * Unlike `lib/supabase/client.ts` (a plain anon client), this reads the logged-in
 * user's session from the same cookies `@supabase/ssr` writes server-side. That
 * means `auth.uid()` is populated, so RLS-gated SELECTs work AND Realtime
 * subscriptions are authenticated — each subscriber only receives the rows their
 * RLS policies allow. Use this for client-side reads and Realtime.
 *
 * NOTE: the env vars MUST be referenced as static `process.env.NEXT_PUBLIC_*`
 * literals so Next.js inlines them into the client bundle. Reading them through
 * a helper that does `process.env[dynamicKey]` returns undefined in the browser.
 */
let cached: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase public env vars are not configured.");
  }
  cached = createBrowserClient(url, anonKey);
  return cached;
}
