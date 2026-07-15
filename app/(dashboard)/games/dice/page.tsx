export const dynamic = "force-dynamic";

import { requireUser } from "@/lib/auth/require-user";
import { getWalletData } from "@/lib/services/wallet-data";
import { DiceGame } from "@/components/games/dice/dice-game";

export default async function DicePage() {
  const { profile } = await requireUser();
  const walletData = await getWalletData(profile.id);
  const balance = walletData?.wallet?.availableBalance ?? "0";

  return (
    <div className="mx-auto max-w-lg px-4 pt-3 pb-6 sm:px-6">
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em", marginBottom: 4 }}>
          Dice
        </h1>
      </div>
      <DiceGame initialBalance={balance} />
    </div>
  );
}
