/**
 * Playwright global setup — runs once before the entire test suite.
 *
 * Creates (or re-syncs) a dedicated test-admin account in Supabase so the
 * admin-dependent tests have working credentials on every run.
 */
import * as path from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { FullConfig } from "@playwright/test";

// Load .env.local first (Supabase keys), then .env.test overrides (URLs, credentials)
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env.test"), override: true });

export const TEST_ADMIN_EMAIL = "testadmin@example.com";
export const TEST_ADMIN_PASSWORD = "AdminTest123!";
export const TEST_SHARED_PASSWORD = "TestPass123!";
export const TEST_SETTLEMENT_EMAIL = "testsettlement@example.com";
export const TEST_PROMOTER_EMAIL = "testpromoter@example.com";
export const TEST_REFERRED_EMAIL = "testreferred@example.com";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableNetworkError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("fetch failed") || message.includes("timeout") || message.includes("network");
}

async function withRetries<T>(fn: () => Promise<T>, attempts = 4, delayMs = 1000): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryableNetworkError(error) || attempt === attempts - 1) {
        throw error;
      }
      await sleep(delayMs * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Global setup failed.");
}

async function ensureAuthUser(
  admin: ReturnType<typeof createClient>,
  email: string,
  password: string,
  user_metadata: Record<string, unknown>,
) {
  const { data: created, error: createError } = await withRetries(() =>
    admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata,
    }),
  );

  let userId = created?.user?.id ?? null;

  if (createError) {
    const isExisting =
      createError.message.toLowerCase().includes("already registered") ||
      createError.message.toLowerCase().includes("already been registered") ||
      createError.message.toLowerCase().includes("already exists") ||
      createError.message.toLowerCase().includes("user already");

    if (!isExisting) {
      throw createError;
    }

    const { data: list } = await withRetries(() => admin.auth.admin.listUsers({ perPage: 1000 }));
    const existing = list?.users?.find((u) => u.email === email);

    if (!existing) {
      throw new Error(`Existing auth user not found for ${email}.`);
    }

    userId = existing.id;

    const { error: updateError } = await withRetries(() =>
      admin.auth.admin.updateUserById(userId!, {
        password,
        email_confirm: true,
        user_metadata,
      }),
    );

    if (updateError) {
      throw updateError;
    }
  }

  if (!userId) {
    throw new Error(`Failed to provision auth user for ${email}.`);
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (profile?.id) {
      return userId;
    }

    await sleep(500);
  }

  throw new Error(`Profile row not ready for ${email}.`);
}

async function globalSetup(_config: FullConfig) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn(
      "[global-setup] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found — " +
        "admin-dependent tests will likely fail.",
    );
    return;
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Try to create the user fresh
  const { data: created, error: createError } = await withRetries(() =>
    admin.auth.admin.createUser({
      email: TEST_ADMIN_EMAIL,
      password: TEST_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { role: "admin", full_name: "Test Admin" },
    }),
  );

  let userId: string | null = created?.user?.id ?? null;

  if (createError) {
    const isExisting =
      createError.message.toLowerCase().includes("already registered") ||
      createError.message.toLowerCase().includes("already been registered") ||
      createError.message.toLowerCase().includes("already exists") ||
      createError.message.toLowerCase().includes("user already");

    if (!isExisting) {
      console.error("[global-setup] Could not create test admin:", createError.message);
      return;
    }

    // Account already exists — find it and sync the password so every run
    // starts with the known password regardless of previous state.
    const { data: list } = await withRetries(() => admin.auth.admin.listUsers({ perPage: 1000 }));
    const existing = list?.users?.find((u) => u.email === TEST_ADMIN_EMAIL);

    if (!existing) {
      console.error("[global-setup] Admin listed as existing but could not locate user.");
      return;
    }

    userId = existing.id;

    // Reset password + ensure confirmed
    const { error: updateError } = await withRetries(() =>
      admin.auth.admin.updateUserById(userId, {
        password: TEST_ADMIN_PASSWORD,
        email_confirm: true,
      }),
    );

    if (updateError) {
      console.warn("[global-setup] Could not sync admin password:", updateError.message);
    } else {
      console.log(`[global-setup] Test admin synced (${TEST_ADMIN_EMAIL})`);
    }
  } else {
    console.log(`[global-setup] Test admin created: ${TEST_ADMIN_EMAIL}`);
  }

  if (!userId) return;

  // Ensure the profiles row has role = 'admin'
  const { error: profileError } = await admin
    .from("profiles")
    .update({ role: "admin" })
    .eq("auth_user_id", userId);

  if (profileError) {
    console.warn("[global-setup] Could not set admin role:", profileError.message);
  } else {
    console.log(`[global-setup] Admin role confirmed for ${TEST_ADMIN_EMAIL}`);
  }

  try {
    await ensureAuthUser(admin, TEST_SETTLEMENT_EMAIL, TEST_SHARED_PASSWORD, {
      role: "user",
      full_name: "Settlement Test User",
    });
    await ensureAuthUser(admin, TEST_PROMOTER_EMAIL, TEST_SHARED_PASSWORD, {
      role: "user",
      full_name: "Promoter Test User",
    });
    await ensureAuthUser(admin, TEST_REFERRED_EMAIL, TEST_SHARED_PASSWORD, {
      role: "user",
      full_name: "Referred Test User",
    });
  } catch (error) {
    console.warn("[global-setup] Could not provision shared test users:", error);
  }
}

export default globalSetup;
