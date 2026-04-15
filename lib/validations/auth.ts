import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password cannot exceed 128 characters."),
  fullName: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed;
    },
    z.string().min(1).max(100).optional(),
  ),
  promoCode: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const normalized = value.trim().toUpperCase();
      return normalized === "" ? undefined : normalized;
    },
    z
      .string()
      .min(4, "Promo code is too short.")
      .max(20, "Promo code is too long.")
      .regex(/^[A-Z0-9]+$/, "Promo code must contain only letters and numbers.")
      .optional(),
  ),
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8).max(128),
}).strict();

