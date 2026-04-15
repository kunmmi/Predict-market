import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";

export async function requirePromoter() {
  const ctx = await requireUser();

  if (ctx.profile.role !== "promoter") {
    redirect("/dashboard");
  }

  return ctx;
}
