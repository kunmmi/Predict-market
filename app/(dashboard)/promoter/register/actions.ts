"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { promoterRegisterSchema } from "@/lib/validations/promoter";

export type PromoterRegisterState = {
  error?: string;
};

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
    const { error } = await admin.rpc("create_promoter", {
      p_profile_id: ctx.profile.id,
      p_display_name: parsed.data.display_name,
      p_commission_rate: 0.1,
    });

    if (error) {
      return { error: error.message };
    }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to register promoter.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/promoter");
  redirect("/promoter");
}
