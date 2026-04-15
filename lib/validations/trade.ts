import { z } from "zod";

/** Body for POST /api/trades — server calls public.place_trade after validation */
export const tradePlaceSchema = z.object({
  market_id: z.string().uuid(),
  side: z.enum(["yes", "no"]),
  amount: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "Amount must be a positive decimal string.")
    .refine((v) => Number.parseFloat(v) > 0, "Amount must be greater than zero."),
  price: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "Price must be a decimal string.")
    .refine((v) => {
      const n = Number.parseFloat(v);
      return n > 0 && n <= 1;
    }, "Price must be > 0 and <= 1."),
  fee_amount: z.preprocess(
    (v) => (v === undefined || v === null || v === "" ? "0" : v),
    z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Fee must be a non-negative decimal string.")
      .refine((v) => Number.parseFloat(v) >= 0, "Fee must be non-negative."),
  ),
});

export type TradePlaceInput = z.infer<typeof tradePlaceSchema>;
