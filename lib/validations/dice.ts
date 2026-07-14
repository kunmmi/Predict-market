import { z } from "zod";

export const DiceRollSchema = z.object({
  bet_amount: z.number().min(1, "Minimum bet is $1").max(500, "Maximum bet is $500"),
  target:     z.number().int().min(2, "Target must be 2–98").max(98, "Target must be 2–98"),
  direction:  z.enum(["over", "under"]),
});

export type DiceRollInput = z.infer<typeof DiceRollSchema>;
