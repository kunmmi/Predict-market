"use client";

import * as React from "react";

/**
 * Shared wallet state for the dashboard.
 *
 * Before this existed, every component that needed the balance (deposit page,
 * withdraw page, trade form, etc.) made its own `/api/wallet` fetch on mount.
 * For a user with multiple tabs/components active, that was many redundant
 * calls to Supabase.
 *
 * Now: a single fetch on dashboard mount, shared across all consumers via
 * React Context. Components call `refetch()` whenever they perform an action
 * that changes the balance (trade placed, deposit confirmed, withdrawal sent).
 */

export type WalletInfo = {
  id: string;
  balance: string;
  availableBalance: string;
  reservedBalance: string;
  status: string;
};

type WalletContextValue = {
  wallet: WalletInfo | null;
  loading: boolean;
  error: string | null;
  /** Refetch the wallet from the API. Returns the new wallet (or null on failure). */
  refetch: () => Promise<WalletInfo | null>;
};

const WalletContext = React.createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = React.useState<WalletInfo | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // De-dupe concurrent refetches into a single in-flight request
  const inFlightRef = React.useRef<Promise<WalletInfo | null> | null>(null);

  const refetch = React.useCallback(async (): Promise<WalletInfo | null> => {
    if (inFlightRef.current) return inFlightRef.current;

    const promise = (async () => {
      try {
        const res = await fetch("/api/wallet", { cache: "no-store" });
        if (!res.ok) {
          setError("Failed to load wallet");
          return null;
        }
        const json = (await res.json()) as { wallet?: WalletInfo };
        if (json.wallet) {
          setWallet(json.wallet);
          setError(null);
          return json.wallet;
        }
        return null;
      } catch {
        setError("Network error");
        return null;
      } finally {
        setLoading(false);
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = promise;
    return promise;
  }, []);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  const value = React.useMemo(
    () => ({ wallet, loading, error, refetch }),
    [wallet, loading, error, refetch],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

/**
 * Read the shared wallet state. Must be called inside a `<WalletProvider>`.
 * Returns `null` if the provider is missing (so components can still degrade
 * gracefully outside the dashboard layout — but they should be inside it).
 */
export function useWallet(): WalletContextValue {
  const ctx = React.useContext(WalletContext);
  if (!ctx) {
    // Fallback shape — components keep working but get no shared data
    return {
      wallet: null,
      loading: false,
      error: null,
      refetch: async () => null,
    };
  }
  return ctx;
}
