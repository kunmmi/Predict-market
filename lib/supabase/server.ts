import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { config } from "@/lib/config";

export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(config.supabase.url(), config.supabase.anonKey(), {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Server Components cannot set cookies.
          // The middleware handles token refresh so this is safe to ignore.
        }
      },
      remove(name: string, options: Record<string, unknown>) {
        try {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 });
        } catch {
          // Server Components cannot set cookies.
          // The middleware handles token refresh so this is safe to ignore.
        }
      },
    },
  });
}

