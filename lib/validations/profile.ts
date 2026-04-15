import { z } from "zod";

export const profileUpdateSchema = z.object({
  full_name: z
    .string()
    .transform((s) => s.trim())
    .transform((s) => (s === "" ? null : s))
    .refine((s) => s === null || s.length <= 100, {
      message: "Name must be at most 100 characters.",
    }),
});

export type ProfileUpdateInput = z.output<typeof profileUpdateSchema>;
