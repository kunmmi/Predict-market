"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { profileUpdateSchema } from "@/lib/validations/profile";

export type UpdateProfileState = { error?: string; success?: boolean };

export async function updateProfileAction(
  _prev: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const raw = formData.get("full_name");
  const parsed = profileUpdateSchema.safeParse({
    full_name: typeof raw === "string" ? raw : "",
  });
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0];
    return {
      error: msg ?? parsed.error.errors[0]?.message ?? "Invalid input",
    };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name })
    .eq("auth_user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/profile");
  return { success: true };
}
