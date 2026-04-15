import { z } from "zod";

const depositAssets = ["BTC", "USDT", "USDC", "BNB", "SOL"] as const;

/** Body for POST /api/deposits — user creates a pending deposit request */
export const depositCreateSchema = z.object({
  asset_symbol: z.enum(depositAssets),
  network_name: z.string().trim().max(200).optional().nullable(),
  amount_expected: z
    .string()
    .optional()
    .nullable()
    .refine(
      (v) => v == null || v === "" || /^\d+(\.\d+)?$/.test(v),
      "Expected amount must be a positive decimal string.",
    )
    .refine((v) => {
      if (v == null || v === "") return true;
      return Number.parseFloat(v) > 0;
    }, "Expected amount must be greater than zero."),
  tx_hash: z.string().trim().max(500).optional().nullable(),
  deposit_address: z.string().trim().max(500).optional().nullable(),
});

export type DepositCreateInput = z.infer<typeof depositCreateSchema>;
