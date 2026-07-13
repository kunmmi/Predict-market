import { z } from "zod";

export const MinesStartSchema = z.object({
  bet_amount: z.number().min(1, "Minimum bet is $1").max(500, "Maximum bet is $500"),
  mine_count: z.number().int().min(1, "Minimum 1 mine").max(24, "Maximum 24 mines"),
});

export const MinesRevealSchema = z.object({
  game_id:    z.string().uuid("Invalid game ID"),
  tile_index: z.number().int().min(0).max(24),
});

export const MinesCashoutSchema = z.object({
  game_id: z.string().uuid("Invalid game ID"),
});

export type MinesStartInput   = z.infer<typeof MinesStartSchema>;
export type MinesRevealInput  = z.infer<typeof MinesRevealSchema>;
export type MinesCashoutInput = z.infer<typeof MinesCashoutSchema>;
