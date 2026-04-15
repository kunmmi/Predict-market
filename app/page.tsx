import Link from "next/link";
import { ArrowRight, BarChart3, Menu } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getPublicActiveMarkets } from "@/lib/services/market-data";
import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { MarketCarousel } from "@/components/ui/market-carousel";

export default async function Home() {
  const { user } = await getCurrentUser();
  const markets = await getPublicActiveMarkets();
  const locale = getLocale();
  const t = getT(locale);
  const tl = t.landing;
  const tn = t.nav;

  const NAV_LINKS = [
    { label: tn.markets,   en: "Markets",   href: "/markets" },
    { label: tn.portfolio, en: "Portfolio", href: "/portfolio" },
    { label: tn.promoter,  en: "Promoters", href: "/promoter" },
  ];

  return (
    <main className="min-h-screen bg-slate-100">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <header className="border-b border-slate-700 bg-slate-900 text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="rounded bg-yellow-400 p-1.5 text-slate-900">
                <BarChart3 className="h-4 w-4" />
              </div>
              <p className="text-base font-semibold tracking-tight">Elemental</p>
            </div>
            <nav className="hidden items-center gap-1 md:flex">
              {NAV_LINKS.map(({ label, en, href }) => (
                <div key={href} className="group relative">
                  <Link
                    href={href}
                    className="rounded-md px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                  >
                    {label}
                  </Link>
                  {locale === "zh" && (
                    <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-900 opacity-0 shadow-lg ring-1 ring-slate-200 transition-opacity group-hover:opacity-100">
                      {en}
                    </span>
                  )}
                </div>
              ))}
            </nav>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <LanguageSwitcher locale={locale} />
            {!user ? (
              <>
                <Link href="/login">
                  <Button variant="secondary" size="sm">{tn.login}</Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm">{tn.register}</Button>
                </Link>
              </>
            ) : (
              <Link href="/dashboard">
                <Button size="sm">{tn.dashboard}</Button>
              </Link>
            )}
          </div>

          <button type="button" className="text-slate-300 md:hidden">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2">
        {/* Left: copy */}
        <div>
          <h1 className="max-w-xl text-5xl font-semibold leading-[1.02] tracking-tight text-slate-900 sm:text-6xl">
            {tl.hero_title_1}
            <br />
            {tl.hero_title_2}
          </h1>
          <p className="mt-6 max-w-md text-xl leading-snug text-slate-600">
            {tl.hero_sub}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={user ? "/markets" : "/signup"}>
              <Button className="h-12 px-6 text-base">
                {user ? tl.cta_browse : tl.cta_start}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            {!user && (
              <Link href="/login">
                <Button variant="outline" className="h-12 px-6 text-base">
                  {tl.cta_login}
                </Button>
              </Link>
            )}
          </div>
          <div className="mt-10 flex items-center gap-6 text-sm text-slate-500">
            <div>
              <span className="font-semibold text-slate-900">{markets.length}</span>
              {" "}
              {markets.length === 1 ? tl.active_markets_singular : tl.active_markets_plural}
            </div>
            <div className="h-4 w-px bg-slate-300" />
            <div>{tl.stat_trade}</div>
            <div className="h-4 w-px bg-slate-300" />
            <div>{tl.stat_settlement}</div>
          </div>
        </div>

        {/* Right: live market carousel */}
        <div className="relative">
          <div className="absolute inset-0 rounded-3xl bg-yellow-200/50 blur-3xl" />
          <div className="relative mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-300/60">
            <MarketCarousel markets={markets} isLoggedIn={!!user} locale={locale} tCarousel={t.carousel} />
          </div>
        </div>
      </section>
    </main>
  );
}
