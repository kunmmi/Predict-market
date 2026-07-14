import { z } from "zod";

export const PlinkoDropSchema = z.object({
  bet_amount: z.number().min(1, "Minimum bet is $1").max(500, "Maximum bet is $500"),
  risk:       z.enum(["low", "medium", "high"]),
});

export type PlinkoDropInput = z.infer<typeof PlinkoDropSchema>;
