export const dynamic = "force-dynamic";

import { requireUser } from "@/lib/auth/require-user";
import { getActiveMarkets } from "@/lib/services/market-data";
import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";
import { MarketsBrowser } from "./markets-browser";

export default async function MarketsPage() {
  await requireUser();
  const markets = await getActiveMarkets();
  const locale = getLocale();
  const tFull = getT(locale);
  const t = tFull.markets;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{t.title}</h1>
        <p className="page-subtitle">{t.subtitle}</p>
      </div>

      <MarketsBrowser
        markets={markets}
        locale={locale}
        t={{
          no_markets: t.no_markets,
          no_markets_sub: t.no_markets_sub,
          short_duration_badge: t.short_duration_badge,
          live_contract: t.live_contract,
          trade_now: t.trade_now,
          closes: t.closes,
        }}
      />
    </div>
  );
}
