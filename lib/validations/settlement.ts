import { z } from "zod";

/** Admin settles a market — calls public.settle_market */
export const marketSettleSchema = z.object({
  resolution: z.enum(["yes", "no", "cancelled"]),
  notes: z.string().trim().max(5000).optional().nullable(),
});

export type MarketSettleInput = z.infer<typeof marketSettleSchema>;
