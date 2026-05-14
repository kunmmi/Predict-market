import { HDNodeWallet } from "ethers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function getXpub(): string {
  const xpub = process.env.DEPOSIT_WALLET_XPUB;
  if (!xpub) throw new Error("DEPOSIT_WALLET_XPUB is not set.");
  return xpub;
}

function deriveAddress(index: number): string {
  const node = HDNodeWallet.fromExtendedKey(getXpub());
  return node.deriveChild(index).address;
}

/**
 * Returns the user's unique BSC deposit address, creating one if not yet
 * assigned.  Safe to call concurrently — the DB sequence function is atomic.
 */
export async function getOrAssignDepositAddress(profileId: string): Promise<string> {
  const supabase = createSupabaseAdminClient();

  // Fast path: already assigned
  const { data: existing } = await supabase
    .from("wallets")
    .select("deposit_address")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (existing?.deposit_address) return existing.deposit_address;

  // Claim the next derivation index atomically
  const { data: index, error: seqError } = await supabase.rpc("get_next_deposit_index");
  if (seqError || index == null) {
    throw new Error(`Failed to get deposit index: ${seqError?.message ?? "null"}`);
  }

  const address = deriveAddress(index as number);

  // Update the wallet row. We omit the `IS NULL` guard here because
  // PostgREST silently returns no error when 0 rows match — instead we
  // verify the write succeeded by re-fetching.
  const { error: updateError } = await supabase
    .from("wallets")
    .update({ deposit_address: address, deposit_address_index: index })
    .eq("profile_id", profileId);

  if (updateError) {
    throw new Error(`Failed to assign deposit address: ${updateError.message}`);
  }

  // Verify the update actually persisted (defensive — catches 0-row edge cases)
  const { data: verified } = await supabase
    .from("wallets")
    .select("deposit_address")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!verified?.deposit_address) {
    throw new Error("Deposit address update did not persist — wallet row may not exist yet.");
  }

  // Subscribe the new address to Tatum (non-blocking — failure is non-fatal)
  subscribeAddressToTatum(address).catch((err: unknown) => {
    console.warn("[deposit-address] Tatum subscription failed for", address, err);
  });

  return address;
}

async function subscribeAddressToTatum(address: string): Promise<void> {
  const apiKey = process.env.TATUM_API_KEY;
  const secret = process.env.TATUM_WEBHOOK_SECRET;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

  if (!apiKey || !appUrl) return;

  const body: Record<string, unknown> = {
    type: "INCOMING_FUNGIBLE_TX",
    attr: {
      address,
      chain: "BSC",
      url: `${appUrl}/api/webhooks/tatum`,
    },
  };

  const res = await fetch("https://api.tatum.io/v4/subscription", {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Tatum subscription failed (${res.status}): ${await res.text()}`);
  }

  // Set HMAC secret on the new subscription if configured
  if (secret) {
    const result = (await res.json()) as { id?: string };
    const subId = result.id;
    if (subId) {
      await fetch(`https://api.tatum.io/v4/subscription/${subId}/hmac`, {
        method: "PUT",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ hmacSecret: secret }),
      }).catch(() => {
        // HMAC endpoint may not exist on all Tatum plans — non-fatal
      });
    }
  }
}
