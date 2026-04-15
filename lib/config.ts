/**
 * Centralized config from env. Validate required vars at startup.
 * Use only in server code for secrets; use NEXT_PUBLIC_* in client.
 */

function getEnv(key: string): string | undefined {
  return process.env[key];
}

function requireEnv(key: string): string {
  const value = getEnv(key);
  if (value == null || value === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  supabase: {
    url: () => requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: () => requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: () => getEnv("SUPABASE_SERVICE_ROLE_KEY"),
  },
  app: {
    url: () => getEnv("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
  },
} as const;
