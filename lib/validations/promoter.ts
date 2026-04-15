import { z } from "zod";

/** Body for promoter registration — display name; promo code comes from DB function */
export const promoterRegisterSchema = z.object({
  display_name: z.string().trim().min(1).max(200),
  commission_rate: z
    .string()
    .optional()
    .refine(
      (v) => v == null || v === "" || /^\d+(\.\d+)?$/.test(v),
      "Commission rate must be a decimal between 0 and 1.",
    )
    .refine((v) => {
      if (v == null || v === "") return true;
      const n = Number.parseFloat(v);
      return n >= 0 && n <= 1;
    }, "Commission rate must be between 0 and 1."),
});

export type PromoterRegisterInput = z.infer<typeof promoterRegisterSchema>;
