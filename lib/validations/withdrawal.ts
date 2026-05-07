import { z } from "zod";

export const FIXED_WITHDRAWAL_ASSET = "USDT" as const;
export const FIXED_WITHDRAWAL_NETWORK = "BNB Smart Chain (BEP-20)" as const;

/** Body for POST /api/withdrawals â€” user creates a pending withdrawal request */
export const withdrawalCreateSchema = z.object({
  asset_symbol: z.literal(FIXED_WITHDRAWAL_ASSET),
  network_name: z.literal(FIXED_WITHDRAWAL_NETWORK),
  amount: z
    .string()
    .trim()
    .refine((v) => /^\d+(\.\d+)?$/.test(v), "Amount must be a positive decimal string.")
    .refine((v) => Number.parseFloat(v) > 0, "Amount must be greater than zero."),
  withdrawal_address: z
    .string()
    .trim()
    .min(10, "Please enter a valid wallet address.")
    .max(500),
  notes: z.string().trim().max(500).optional().nullable(),
});

export type WithdrawalCreateInput = z.infer<typeof withdrawalCreateSchema>;
