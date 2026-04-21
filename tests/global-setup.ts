/**
 * Playwright global setup — runs once before the entire test suite.
 *
 * Creates a dedicated test-admin account in Supabase so the admin-dependent
 * tests (deposit approval, settlement, commissions) have working credentials
 * without depending on the developer's personal Google-OAuth account.
 */
import * as path from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { FullConfig } from "@playwright/test";

// Load env files — order matters: .env.test overrides .env.local overrides .env
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env.test"), override: true });

export const TEST_ADMIN_EMAIL = "testadmin@elemental.test";
export const TEST_ADMIN_PASSWORD = "AdminTest123!";

async function globalSetup(_config: FullConfig) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn(
      "[global-setup] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found." +
        " Admin-dependent tests will be skipped.",
    );
    return;
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Attempt to create the test-admin account. If it already exists, Supabase
  // returns an error which we silently ignore — the account is ready to use.
  const { data, error } = await adminClient.auth.admin.createUser({
    email: TEST_ADMIN_EMAIL,
    password: TEST_ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      role: "admin",
      full_name: "Test Admin",
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    const alreadyExists =
      msg.includes("already registered") ||
      msg.includes("already been registered") ||
      msg.includes("already exists") ||
      msg.includes("user already");
    if (alreadyExists) {
      console.log(`[global-setup] Test admin already exists (${TEST_ADMIN_EMAIL}), ready.`);
    } else {
      console.error("[global-setup] Failed to create test admin:", error.message);
    }
    return;
  }

  // Belt-and-suspenders: ensure the profiles row has role = 'admin'.
  // The DB trigger should do this automatically via raw_user_meta_data, but
  // we do it explicitly in case the trigger ran before metadata was set.
  const { error: profileError } = await adminClient
    .from("profiles")
    .update({ role: "admin" })
    .eq("auth_user_id", data.user.id);

  if (profileError) {
    console.warn("[global-setup] Could not force admin role in profiles:", profileError.message);
  } else {
    console.log(`[global-setup] Test admin created and confirmed: ${TEST_ADMIN_EMAIL}`);
  }
}

export default globalSetup;
