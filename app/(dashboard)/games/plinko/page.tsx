export const dynamic = "force-dynamic";

import { requireUser } from "@/lib/auth/require-user";
import { getWalletData } from "@/lib/services/wallet-data";
import { PlinkoGame } from "@/components/games/plinko/plinko-game";

export default async function PlinkoPage() {
  const { profile } = await requireUser();
  const walletData = await getWalletData(profile.id);
  const balance = walletData?.wallet?.availableBalance ?? "0";

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em", marginBottom: 4 }}>
          Plinko
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
          Drop the ball, watch it bounce through 16 rows of pegs. Where it lands is your multiplier.
        </p>
      </div>
      <PlinkoGame initialBalance={balance} />
    </div>
  );
}
