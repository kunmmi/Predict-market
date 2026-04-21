import { type Page, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "./global-setup";

export const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

// Admin credentials come from global-setup (auto-created Supabase test admin)
export const ADMIN_EMAIL = TEST_ADMIN_EMAIL;
export const ADMIN_PASSWORD = TEST_ADMIN_PASSWORD;

let adminDbClient: SupabaseClient | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableNetworkError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("name_not_resolved")
  );
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

  throw lastError instanceof Error ? lastError : new Error("Operation failed.");
}

function getAdminDbClient(): SupabaseClient {
  if (adminDbClient) return adminDbClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  adminDbClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return adminDbClient;
}

async function getAuthUserIdByEmail(email: string): Promise<string | null> {
  const admin = getAdminDbClient();
  const { data } = await withRetries(() => admin.auth.admin.listUsers({ perPage: 1000 }));
  const existing = data?.users?.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  return existing?.id ?? null;
}

async function getProfileIdByEmail(email: string): Promise<string> {
  const admin = getAdminDbClient();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!error && data?.id) {
      return data.id as string;
    }

    const authUserId = await getAuthUserIdByEmail(email);
    if (authUserId) {
      const byAuthUser = await admin
        .from("profiles")
        .select("id")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      if (!byAuthUser.error && byAuthUser.data?.id) {
        return byAuthUser.data.id as string;
      }
    }

    await sleep(500);
  }

  throw new Error(`Profile not found for ${email}.`);
}

const PROMO_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generatePromoCode(displayName: string): string {
  const prefix = displayName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4)
    .padEnd(4, "X");

  let suffix = "";
  for (let i = 0; i < 4; i += 1) {
    suffix += PROMO_CODE_ALPHABET[Math.floor(Math.random() * PROMO_CODE_ALPHABET.length)];
  }

  return `${prefix}${suffix}`;
}

/** Unique suffix so parallel test runs don't clash */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Log in via the UI and wait for the dashboard */
export async function loginAs(page: Page, email: string, password: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await page.goto("/login");
      await page.getByLabel(/email or username/i).fill(email);
      await page.getByLabel(/password/i).fill(password);
      await page.getByRole("button", { name: /sign in/i }).click();
      await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
      return;
    } catch (error) {
      lastError = error;
      if (attempt === 3) {
        throw error;
      }
      await sleep(1500 * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Login failed.");
}

/** Log out via the auth API route */
export async function logout(page: Page) {
  await page.goto("/api/auth/logout", { waitUntil: "commit" });
}

export async function ensureUserAccount(params: {
  email: string;
  password: string;
  fullName?: string;
}) {
  const admin = getAdminDbClient();
  const fullName = params.fullName ?? params.email.split("@")[0];

  const created = await withRetries(() =>
    admin.auth.admin.createUser({
      email: params.email,
      password: params.password,
      email_confirm: true,
      user_metadata: { role: "user", full_name: fullName },
    }),
  );

  let authUserId = created.data.user?.id ?? null;

  if (created.error) {
    const message = created.error.message.toLowerCase();
    const isExisting =
      message.includes("already registered") ||
      message.includes("already been registered") ||
      message.includes("already exists") ||
      message.includes("user already");

    if (!isExisting) {
      throw new Error(created.error.message);
    }

    authUserId = await getAuthUserIdByEmail(params.email);
    if (!authUserId) {
      throw new Error(`Auth user not found for ${params.email}.`);
    }

    const updated = await withRetries(() =>
      admin.auth.admin.updateUserById(authUserId!, {
        password: params.password,
        email_confirm: true,
        user_metadata: { role: "user", full_name: fullName },
      }),
    );

    if (updated.error) {
      throw new Error(updated.error.message);
    }
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const profile = await admin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (!profile.error && profile.data?.id) {
      return {
        authUserId,
        profileId: profile.data.id as string,
      };
    }

    await sleep(500);
  }

  throw new Error(`Profile not ready for ${params.email}.`);
}

export async function ensureReferralLink(referredEmail: string, promoCode: string) {
  const admin = getAdminDbClient();
  const referredProfileId = await getProfileIdByEmail(referredEmail);
  const promoter = await admin
    .from("promoters")
    .select("id")
    .eq("promo_code", promoCode.trim().toUpperCase())
    .maybeSingle();

  if (promoter.error || !promoter.data?.id) {
    throw new Error(`Promoter not found for promo code ${promoCode}.`);
  }

  const profileUpdate = await admin
    .from("profiles")
    .update({ referred_by_promoter_id: promoter.data.id })
    .eq("id", referredProfileId);

  if (profileUpdate.error) {
    throw new Error(profileUpdate.error.message);
  }

  const referralInsert = await admin.from("referrals").insert({
    promoter_id: promoter.data.id,
    referred_profile_id: referredProfileId,
    promo_code_used: promoCode.trim().toUpperCase(),
  });

  if (referralInsert.error && referralInsert.error.code !== "23505") {
    throw new Error(referralInsert.error.message);
  }
}

export async function ensurePromoterProfile(email: string, displayName: string) {
  const admin = getAdminDbClient();
  const profileId = await getProfileIdByEmail(email);

  const existing = await admin
    .from("promoters")
    .select("id, promo_code")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  if (existing.data?.promo_code) {
    await admin.from("profiles").update({ role: "promoter" }).eq("id", profileId);
    return {
      promoterId: existing.data.id as string,
      promoCode: existing.data.promo_code as string,
    };
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const promoCode = generatePromoCode(displayName);
    const insert = await admin
      .from("promoters")
      .insert({
        profile_id: profileId,
        display_name: displayName,
        promo_code: promoCode,
        commission_rate: 0.1,
        status: "active",
      })
      .select("id, promo_code")
      .single();

    if (!insert.error && insert.data?.promo_code) {
      const update = await admin
        .from("profiles")
        .update({ role: "promoter" })
        .eq("id", profileId);

      if (update.error) {
        throw new Error(update.error.message);
      }

      return {
        promoterId: insert.data.id as string,
        promoCode: insert.data.promo_code as string,
      };
    }

    if (insert.error?.code !== "23505") {
      throw new Error(insert.error?.message ?? "Failed to create promoter profile.");
    }
  }

  throw new Error("Failed to generate a unique promoter promo code.");
}

export async function approveDepositByTxHash(txHash: string, amountReceived: string | number) {
  const admin = getAdminDbClient();
  const adminProfileId = await getProfileIdByEmail(ADMIN_EMAIL);
  const { data, error } = await admin
    .from("deposits")
    .select("id")
    .eq("tx_hash", txHash)
    .maybeSingle();

  if (error || !data?.id) {
    throw new Error(`Deposit not found for tx hash ${txHash}.`);
  }

  const result = await admin.rpc("approve_deposit", {
    p_deposit_id: data.id,
    p_admin_profile_id: adminProfileId,
    p_amount_received: Number(amountReceived),
    p_admin_notes: null,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }
}

export async function createActiveMarket(overrides?: {
  title?: string;
  slug?: string;
  yesPrice?: number;
  assetSymbol?: "BTC" | "ETH" | "SOL" | "BNB" | "USDT" | "USDC" | "XRP" | "ADA" | "DOGE";
}) {
  const admin = getAdminDbClient();
  const adminProfileId = await getProfileIdByEmail(ADMIN_EMAIL);
  const suffix = uid().toLowerCase();
  const title = overrides?.title ?? `Test Market ${suffix}`;
  const slug = overrides?.slug ?? `test-market-${suffix}`;
  const yesPrice = overrides?.yesPrice ?? 0.3;
  const noPrice = Number((1 - yesPrice).toFixed(4));

  const closeAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const settleAt = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();

  const marketInsert = await admin
    .from("markets")
    .insert({
      title,
      slug,
      description: "Created by Playwright live tests.",
      category: "Testing",
      asset_symbol: overrides?.assetSymbol ?? "BTC",
      question_text: title,
      rules_text: "Resolves YES for test settlements unless otherwise specified.",
      close_at: closeAt,
      settle_at: settleAt,
      status: "active",
      created_by: adminProfileId,
    })
    .select("id, slug")
    .single();

  if (marketInsert.error || !marketInsert.data?.id) {
    throw new Error(marketInsert.error?.message ?? "Failed to create test market.");
  }

  const priceInsert = await admin.from("market_prices").insert({
    market_id: marketInsert.data.id,
    yes_price: yesPrice,
    no_price: noPrice,
    source: "playwright",
  });

  if (priceInsert.error) {
    throw new Error(priceInsert.error.message);
  }

  return {
    id: marketInsert.data.id as string,
    slug: marketInsert.data.slug as string,
    yesPrice,
    noPrice,
  };
}

export async function rejectDepositByTxHash(txHash: string, notes: string) {
  const admin = getAdminDbClient();
  const adminProfileId = await getProfileIdByEmail(ADMIN_EMAIL);
  const { data, error } = await admin
    .from("deposits")
    .select("id")
    .eq("tx_hash", txHash)
    .maybeSingle();

  if (error || !data?.id) {
    throw new Error(`Deposit not found for tx hash ${txHash}.`);
  }

  const result = await admin.rpc("reject_deposit", {
    p_deposit_id: data.id,
    p_admin_profile_id: adminProfileId,
    p_admin_notes: notes,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }
}

export async function settleMarketBySlug(
  slug: string,
  outcome: "yes" | "no" | "cancelled",
  notes: string,
) {
  const admin = getAdminDbClient();
  const adminProfileId = await getProfileIdByEmail(ADMIN_EMAIL);
  const { data, error } = await admin
    .from("markets")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data?.id) {
    throw new Error(`Market not found for slug ${slug}.`);
  }

  const result = await admin.rpc("settle_market", {
    p_market_id: data.id,
    p_resolution: outcome,
    p_admin_profile_id: adminProfileId,
    p_notes: notes,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }
}
