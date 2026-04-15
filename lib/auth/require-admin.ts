import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";

export async function requireAdmin() {
  const ctx = await requireUser();

  if (ctx.profile.role !== "admin") {
    redirect("/dashboard");
  }

  return ctx;
}
