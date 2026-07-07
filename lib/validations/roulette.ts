import { z } from "zod";

const BetTypeSchema = z.enum([
  "red", "black", "odd", "even", "low", "high",
  "dozen1", "dozen2", "dozen3", "straight",
]);

const RouletteBetSchema = z.object({
  type:   BetTypeSchema,
  amount: z.number().min(1, "Minimum bet is $1").max(500, "Maximum bet per position is $500"),
  number: z.number().int().min(0).max(36).optional(),
}).refine(
  (b) => b.type !== "straight" || b.number !== undefined,
  { message: "Straight bets require a number (0–36)" }
);

export const RouletteSpinSchema = z.object({
  bets: z
    .array(RouletteBetSchema)
    .min(1, "Place at least one bet")
    .max(10, "Maximum 10 bet positions per spin"),
});

export type RouletteSpinInput = z.infer<typeof RouletteSpinSchema>;
