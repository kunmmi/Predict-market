"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { promoterRegisterSchema } from "@/lib/validations/promoter";

export type PromoterRegisterState = {
  error?: string;
};

const PROMO_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generatePromoCode(displayName: string): string {
  const prefix = displayName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4)
    .padEnd(4, "X");
  const bytes = randomBytes(4);
  let suffix = "";
  for (const value of bytes) {
    suffix += PROMO_CODE_ALPHABET[value % PROMO_CODE_ALPHABET.length];
  }
  return `${prefix}${suffix}`;
}

export async function registerPromoterAction(
  _prev: PromoterRegisterState,
  formData: FormData,
): Promise<PromoterRegisterState> {
  const ctx = await requireUser();
  if (ctx.profile.role === "promoter") {
    redirect("/promoter");
  }

  const parsed = promoterRegisterSchema.safeParse({
    display_name: formData.get("display_name"),
    commission_rate: "",
  });

  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0];
    return { error: msg ?? parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  try {
    const admin = createSupabaseAdminClient();
    let lastError: string | null = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const promoCode = generatePromoCode(parsed.data.display_name);
      const { error } = await admin.from("promoters").insert({
        profile_id: ctx.profile.id,
        display_name: parsed.data.display_name,
        promo_code: promoCode,
        commission_rate: 0.1,
        status: "active",
      });

      if (!error) {
        const { error: profileError } = await admin
          .from("profiles")
          .update({ role: "promoter" })
          .eq("id", ctx.profile.id);

        if (profileError) {
          return { error: profileError.message };
        }

        revalidatePath("/dashboard");
        revalidatePath("/promoter");
        redirect("/promoter");
      }

      if (error.code !== "23505") {
        return { error: error.message };
      }

      lastError = error.message;
    }

    return { error: lastError ?? "Failed to generate a unique promo code." };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to register promoter.",
    };
  }
}
