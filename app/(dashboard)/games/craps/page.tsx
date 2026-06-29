export const dynamic = "force-dynamic";

import { requireUser } from "@/lib/auth/require-user";
import { getWalletData } from "@/lib/services/wallet-data";
import { CrapsTable } from "@/components/games/craps/craps-table";

export default async function CrapsPage() {
  const { profile } = await requireUser();
  const walletData = await getWalletData(profile.id);

  const balance = walletData?.wallet?.availableBalance ?? "0";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "-0.01em",
            marginBottom: 4,
          }}
        >
          Craps
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
          Casino-style craps with real USDT. Pass, Don&apos;t Pass, and Field bets. 2% fee on winnings.
        </p>
      </div>

      <CrapsTable initialBalance={balance} />
    </div>
  );
}
