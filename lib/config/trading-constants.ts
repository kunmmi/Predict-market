/**
 * House economics — single source of truth for all fee/spread constants.
 *
 * BUY_FEE_RATE  — charged on top of stake at entry (visible to user)
 * OVERROUND     — both YES and NO prices scaled by (1 + OVERROUND) so they
 *                 sum to > 1.0; this is the built-in spread on every buy
 * SELL_FEE_RATE — deducted from gross sell proceeds at exit
 *
 * Combined house edge per buy-hold-to-expiry round: ~8-9%
 * Combined house edge per buy-sell-early cycle:     ~8-9% (sell fee closes the loophole)
 */
export const BUY_FEE_RATE  = 0.025; // 2.5%
export const OVERROUND     = 0.06;  // 6%   (was 4%)
export const SELL_FEE_RATE = 0.02;  // 2%
