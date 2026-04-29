import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export type CurrentUser = {
  id: string;
  email: string | null;
};

export type CurrentProfile = {
  id: string;
  auth_user_id: string;
  email: string;
  full_name: string | null;
  role: "user" | "promoter" | "admin";
  status: "active" | "inactive" | "suspended";
  referred_by_promoter_id: string | null;
};

export type CurrentWallet = {
  id: string;
  profile_id: string;
  balance: string;
  available_balance: string;
  reserved_balance: string;
  status: "active" | "locked" | "suspended";
};

async function getAuthenticatedUserWithFallback() {
  const supabase = createSupabaseServerClient();

  let user: User | null = null;
  let userErrorMessage: string | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const {
      data: { user: nextUser },
      error,
    } = await supabase.auth.getUser();

    if (!error) {
      user = nextUser;
      userErrorMessage = null;
      break;
    }

    userErrorMessage = error.message;
    if (attempt < 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  if (!user && userErrorMessage) {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (!sessionError && session?.user) {
      user = session.user;
      userErrorMessage = null;
    }
  }

  return { supabase, user, userErrorMessage };
}

export async function getCurrentUser(): Promise<{
  user: CurrentUser | null;
  profile: CurrentProfile | null;
  wallet: CurrentWallet | null;
  error: string | null;
}> {
  const { supabase, user, userErrorMessage } = await getAuthenticatedUserWithFallback();

  if (userErrorMessage) {
    return { user: null, profile: null, wallet: null, error: userErrorMessage };
  }

  if (!user) {
    return { user: null, profile: null, wallet: null, error: null };
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  // maybeSingle() returns null data (not an error) when 0 rows are found.
  // An error here means a genuine query failure — treat as non-fatal for now.
  if (profileError || !profile) {
    return {
      user: { id: user.id, email: user.email ?? null },
      profile: null,
      wallet: null,
      error: null,
    };
  }

  const {
    data: wallet,
    error: walletError,
  } = await supabase
    .from("wallets")
    .select("*")
    .eq("profile_id", (profile as CurrentProfile).id)
    .maybeSingle();

  if (walletError) {
    return {
      user: { id: user.id, email: user.email ?? null },
      profile: profile as CurrentProfile,
      wallet: null,
      error: null,
    };
  }

  return {
    user: { id: user.id, email: user.email ?? null },
    profile: profile as CurrentProfile,
    wallet: wallet as CurrentWallet,
    error: null,
  };
}
