import { z } from "zod";

const commissionStatuses = ["pending", "approved", "paid", "cancelled"] as const;

/** Admin PATCH commission status (when implemented) */
export const commissionStatusUpdateSchema = z.object({
  status: z.enum(commissionStatuses),
});

export type CommissionStatusUpdateInput = z.infer<typeof commissionStatusUpdateSchema>;
