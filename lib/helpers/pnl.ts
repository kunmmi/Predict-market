/**
 * effectivePnl — pure helper, no server imports.
 * Safe to import in both server components and client components.
 *
 *   - Win:            positive (payout received)
 *   - Loss:           negative (-amount staked)
 *   - Void/cancelled: 0
 */
export function effectivePnl(pos: {
  pnlAmount: string;
  yesUnits: string;
  noUnits: string;
  avgYesPrice: string | null;
  avgNoPrice: string | null;
  status: string;
  resolutionOutcome?: string | null;
}): number {
  const pnl = parseFloat(pos.pnlAmount);
  if (pnl > 0) return pnl;
  if (pnl < 0) return pnl;

  const isVoid =
    pos.status === "cancelled" ||
    pos.resolutionOutcome === "void" ||
    pos.resolutionOutcome === "cancelled";
  if (isVoid) return 0;

  const staked =
    parseFloat(pos.yesUnits) * parseFloat(pos.avgYesPrice ?? "0") +
    parseFloat(pos.noUnits) * parseFloat(pos.avgNoPrice ?? "0");
  return -staked;
}
