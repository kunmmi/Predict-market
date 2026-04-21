import { z } from "zod";

const promoCodeField = z.preprocess(
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
);

/** Sign up with email + password */
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
  promoCode: promoCodeField,
}).strict();

/** Sign up with username + password (no email required) */
export const signupUsernameSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters.")
    .max(20, "Username cannot exceed 20 characters.")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers and underscores."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password cannot exceed 128 characters."),
  promoCode: promoCodeField,
}).strict();

/**
 * Login accepts either a real email address or a plain username.
 * The API detects which one was supplied and resolves accordingly.
 */
export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3, "Enter your email or username.")
    .max(254),
  password: z.string().min(1).max(128),
}).strict();

