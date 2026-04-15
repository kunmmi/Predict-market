import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/get-current-user";

/**
 * Server-only: require an authenticated user with a profile row.
 */
export async function requireUser() {
  const { user, profile, wallet, error } = await getCurrentUser();

  if (error) {
    redirect("/login");
  }

  if (!user) {
    redirect("/login");
  }

  if (!profile) {
    redirect("/login?error=profile_missing");
  }

  return { user, profile, wallet };
}
