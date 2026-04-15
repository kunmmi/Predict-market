import { z } from "zod";

const marketAssets = [
  "BTC",
  "ETH",
  "SOL",
  "BNB",
  "USDT",
  "USDC",
  "XRP",
  "ADA",
  "DOGE",
] as const;

const marketStatuses = ["draft", "active", "closed", "settled", "cancelled"] as const;

const marketFieldsSchema = z.object({
  title: z.string().trim().min(1).max(500),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case."),
  description: z.string().trim().max(20000).optional().nullable(),
  category: z.string().trim().max(200).optional().nullable(),
  asset_symbol: z.enum(marketAssets),
  question_text: z.string().trim().min(1).max(2000),
  rules_text: z.string().trim().max(20000).optional().nullable(),
  close_at: z.string().datetime({ offset: true }),
  settle_at: z.string().datetime({ offset: true }),
  status: z.enum(marketStatuses).optional().default("draft"),
  // Chinese translations (optional)
  title_zh: z.string().trim().max(500).optional().nullable(),
  description_zh: z.string().trim().max(20000).optional().nullable(),
  question_text_zh: z.string().trim().max(2000).optional().nullable(),
  rules_text_zh: z.string().trim().max(20000).optional().nullable(),
});

/** Admin creates a market — matches public.markets insert fields used in MVP */
export const marketCreateSchema = marketFieldsSchema.refine(
  (data) => new Date(data.settle_at) >= new Date(data.close_at),
  {
    message: "settle_at must be >= close_at",
    path: ["settle_at"],
  },
);

export type MarketCreateInput = z.infer<typeof marketCreateSchema>;

/** Partial updates — when both times are sent, ordering is validated */
export const marketUpdateSchema = marketFieldsSchema.partial().refine(
  (data) => {
    const { close_at: c, settle_at: s } = data;
    if (c != null && s != null) {
      return new Date(s) >= new Date(c);
    }
    return true;
  },
  { message: "settle_at must be >= close_at", path: ["settle_at"] },
);

export type MarketUpdateInput = z.infer<typeof marketUpdateSchema>;
