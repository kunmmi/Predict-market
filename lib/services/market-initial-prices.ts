import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const DEFAULT_INITIAL_YES_PRICE = 0.5;
export const DEFAULT_INITIAL_NO_PRICE = 0.5;

type MarketWithoutPrice = {
  id: string;
  slug: string;
};

export type InitialPriceResult = {
  marketId: string;
  slug: string;
  inserted: boolean;
  skipped?: string;
};

export async function insertInitialMarketPrice(
  marketId: string,
  source = "initial",
): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.from("market_prices").insert({
    market_id: marketId,
    yes_price: DEFAULT_INITIAL_YES_PRICE,
    no_price: DEFAULT_INITIAL_NO_PRICE,
    source,
  });

  if (error) {
    throw new Error(`Failed to insert initial market price: ${error.message}`);
  }
}

export async function backfillMissingMarketPrices(): Promise<InitialPriceResult[]> {
  const supabase = createSupabaseAdminClient();

  const { data: markets, error } = await supabase
    .from("markets")
    .select("id, slug, market_prices(id)")
    .in("status", ["draft", "active", "closed"]);

  if (error) {
    throw new Error(`Failed to fetch markets for initial price backfill: ${error.message}`);
  }

  const missingPrices = ((markets ?? []) as Array<
    MarketWithoutPrice & { market_prices?: Array<{ id: string }> | null }
  >).filter((market) => !market.market_prices || market.market_prices.length === 0);

  const results: InitialPriceResult[] = [];

  for (const market of missingPrices) {
    const { error: insertError } = await supabase.from("market_prices").insert({
      market_id: market.id,
      yes_price: DEFAULT_INITIAL_YES_PRICE,
      no_price: DEFAULT_INITIAL_NO_PRICE,
      source: "initial_backfill",
    });

    results.push({
      marketId: market.id,
      slug: market.slug,
      inserted: !insertError,
      skipped: insertError?.message,
    });
  }

  return results;
}
