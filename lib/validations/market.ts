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

const durationValues = [3, 5, 10, 15] as const;

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
  // For short-duration markets, close_at/settle_at are computed server-side
  close_at: z.string().datetime({ offset: true }).optional(),
  settle_at: z.string().datetime({ offset: true }).optional(),
  status: z.enum(marketStatuses).optional().default("draft"),
  // Chinese translations (optional)
  title_zh: z.string().trim().max(500).optional().nullable(),
  description_zh: z.string().trim().max(20000).optional().nullable(),
  question_text_zh: z.string().trim().max(2000).optional().nullable(),
  rules_text_zh: z.string().trim().max(20000).optional().nullable(),
  // Short-duration fields
  duration_minutes: z.union(durationValues.map((v) => z.literal(v)) as [z.ZodLiteral<3>, z.ZodLiteral<5>, z.ZodLiteral<10>, z.ZodLiteral<15>]).nullable().optional(),
  target_direction: z.enum(["above", "below"]).nullable().optional(),
});

/** Admin creates a market — matches public.markets insert fields used in MVP */
export const marketCreateSchema = marketFieldsSchema.refine(
  (data) => {
    // Short-duration markets have close_at computed server-side
    if (data.duration_minutes != null) return true;
    if (!data.close_at || !data.settle_at) return false;
    return new Date(data.settle_at) >= new Date(data.close_at);
  },
  {
    message: "settle_at must be >= close_at (or use duration_minutes for short-duration markets)",
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
