import { z } from "zod";

const withdrawalAssets = ["BTC", "USDT", "USDC", "BNB", "SOL"] as const;

/** Body for POST /api/withdrawals — user creates a pending withdrawal request */
export const withdrawalCreateSchema = z.object({
  asset_symbol: z.enum(withdrawalAssets),
  network_name: z.string().trim().max(200).optional().nullable(),
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
