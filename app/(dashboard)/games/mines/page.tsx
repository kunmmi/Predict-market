export const dynamic = "force-dynamic";

import { requireUser } from "@/lib/auth/require-user";
import { getWalletData } from "@/lib/services/wallet-data";
import { MinesGame } from "@/components/games/mines/mines-game";

export default async function MinesPage() {
  const { profile } = await requireUser();
  const walletData = await getWalletData(profile.id);
  const balance = walletData?.wallet?.availableBalance ?? "0";

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em", marginBottom: 4 }}>
          Mines
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
          Reveal gems, avoid mines. Cash out before you hit one.
        </p>
      </div>
      <MinesGame initialBalance={balance} />
    </div>
  );
}
