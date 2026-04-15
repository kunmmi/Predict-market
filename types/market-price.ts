/** public.market_prices row */
export type MarketPriceRow = {
  id: string;
  market_id: string;
  yes_price: string;
  no_price: string;
  source: string | null;
  created_at: string;
};
