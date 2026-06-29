import { z } from "zod";

const BET_TYPES = ["pass_line", "dont_pass", "field"] as const;

export const CrapsBetSchema = z.object({
  type: z.enum(BET_TYPES),
  amount: z
    .number({ invalid_type_error: "Bet amount must be a number" })
    .min(1, "Minimum bet is $1")
    .max(500, "Maximum bet is $500"),
});

export const CrapsRollSchema = z
  .object({
    bets: z
      .array(CrapsBetSchema)
      .min(1, "Place at least one bet")
      .max(3, "Maximum 3 bet types"),
    phase: z.enum(["come_out", "point"]),
    point_number: z
      .number()
      .refine((n) => [4, 5, 6, 8, 9, 10].includes(n), {
        message: "Point must be 4, 5, 6, 8, 9, or 10",
      })
      .optional(),
  })
  .refine(
    (data) => {
      if (data.phase === "point" && !data.point_number) return false;
      return true;
    },
    { message: "point_number is required in point phase", path: ["point_number"] }
  );

export type CrapsRollInput = z.infer<typeof CrapsRollSchema>;
