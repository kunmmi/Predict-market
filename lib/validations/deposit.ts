import { z } from "zod";

export const FIXED_SETTLEMENT_ASSET = "USDT" as const;
export const FIXED_SETTLEMENT_NETWORK = "BNB Smart Chain (BEP-20)" as const;

/** Body for POST /api/deposits — user creates a pending deposit request */
export const depositCreateSchema = z.object({
  asset_symbol: z.literal(FIXED_SETTLEMENT_ASSET),
  network_name: z.literal(FIXED_SETTLEMENT_NETWORK),
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
  sender_wallet: z.string().trim().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid wallet address").optional().nullable(),
});

export type DepositCreateInput = z.infer<typeof depositCreateSchema>;
