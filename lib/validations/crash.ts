import { z } from "zod";

export const CrashPlaySchema = z.object({
  bet_amount:   z.number().min(1, "Minimum bet is $1").max(500, "Maximum bet is $500"),
  auto_cashout: z.number().min(1.01, "Minimum cashout is 1.01x").max(100, "Maximum cashout is 100x"),
});

export type CrashPlayInput = z.infer<typeof CrashPlaySchema>;
