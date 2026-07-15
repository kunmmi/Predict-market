export const dynamic = "force-dynamic";

import { requireUser } from "@/lib/auth/require-user";
import { getWalletData } from "@/lib/services/wallet-data";
import { CrashGame } from "@/components/games/crash/crash-game";

export default async function CrashPage() {
  const { profile } = await requireUser();
  const walletData = await getWalletData(profile.id);
  const balance = walletData?.wallet?.availableBalance ?? "0";

  return (
    <div
      className="-mt-8 -mx-4 sm:-mx-6 -mb-20 md:-mb-8"
      style={{ height: "calc(100dvh - 56px)", overflowY: "auto" }}
    >
      <div className="mx-auto max-w-2xl px-4 pt-3 pb-6 sm:px-6">
        <div style={{ marginBottom: 8 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
            Crash
          </h1>
        </div>
        <CrashGame initialBalance={balance} />
      </div>
    </div>
  );
}
