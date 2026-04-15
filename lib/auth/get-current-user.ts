import { createSupabaseServerClient } from "@/lib/supabase/server";

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

export async function getCurrentUser(): Promise<{
  user: CurrentUser | null;
  profile: CurrentProfile | null;
  wallet: CurrentWallet | null;
  error: string | null;
}> {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return { user: null, profile: null, wallet: null, error: userError.message };
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

