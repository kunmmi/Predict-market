import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/require-user";
import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";
import { formatDecimal } from "@/lib/helpers/format-decimal";
import {
  getPromoterCommissions,
  getPromoterReferrals,
  getPromoterSummaryByProfileId,
} from "@/lib/services/promoter-data";

function formatWhen(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function PromoterDashboardPage() {
  const { profile } = await requireUser();
  const locale = getLocale();
  const t = getT(locale).promoter;
  const summary = await getPromoterSummaryByProfileId(profile.id);

  if (!summary) {
    return (
      <div className="space-y-6">
        <h1 className="page-title">{t.title}</h1>
        <Card>
          <CardContent className="pt-6 text-sm text-slate-700">
            {t.no_profile}{" "}
            <Link className="underline" href="/promoter/register">
              {t.no_profile_link}
            </Link>{" "}
            {t.no_profile_end}
          </CardContent>
        </Card>
      </div>
    );
  }

  const [referrals, commissions] = await Promise.all([
    getPromoterReferrals(summary.promoterId, 20),
    getPromoterCommissions(summary.promoterId, 30),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{t.title}</h1>
        <p className="page-subtitle">
          {t.promo_code}{" "}
          <code className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
            {summary.promoCode}
          </code>
        </p>
        <p className="mt-2 flex gap-4 text-sm">
          <Link className="underline" href="/promoter/referrals">
            {t.referral_list}
          </Link>
          <Link className="underline" href="/promoter/commissions">
            {t.commission_history_link}
          </Link>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.referred_users}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-700">
            <p>{t.total} {summary.totalReferredUsers}</p>
            <p>{t.active} {summary.activeReferredUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.commissions}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-700">
            <p>{t.pending} {formatDecimal(summary.pendingCommission)}</p>
            <p>{t.approved} {formatDecimal(summary.approvedCommission)}</p>
            <p>{t.paid} {formatDecimal(summary.paidCommission)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.profile_title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-700">
            <p>{t.status} {summary.status}</p>
            <p>{t.rate} {formatDecimal(summary.commissionRate, 4)}</p>
            <p>{t.total_generated} {formatDecimal(summary.totalCommissionGenerated)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.referral_history}</CardTitle>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <p className="text-sm text-slate-600">{t.no_referrals}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="hidden pb-2 pr-3 font-medium sm:table-cell">{t.col_when}</th>
                    <th className="pb-2 pr-3 font-medium">{t.col_referred_profile}</th>
                    <th className="pb-2 font-medium">{t.col_promo_code}</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0">
                      <td className="hidden py-2 pr-3 sm:table-cell">{formatWhen(r.createdAt, locale)}</td>
                      <td className="py-2 pr-3">{r.referredProfileId}</td>
                      <td className="py-2">
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                          {r.promoCodeUsed}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.commission_history}</CardTitle>
        </CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <p className="text-sm text-slate-600">{t.no_commissions}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="hidden pb-2 pr-3 font-medium sm:table-cell">{t.col_when}</th>
                    <th className="pb-2 pr-3 font-medium">{t.col_status}</th>
                    <th className="hidden pb-2 pr-3 font-medium md:table-cell">{t.col_referred_profile}</th>
                    <th className="hidden pb-2 pr-3 font-medium md:table-cell">{t.col_fee_source}</th>
                    <th className="hidden pb-2 pr-3 font-medium sm:table-cell">{t.col_rate}</th>
                    <th className="pb-2 font-medium">{t.col_commission}</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100 last:border-0">
                      <td className="hidden py-2 pr-3 sm:table-cell">{formatWhen(c.createdAt, locale)}</td>
                      <td className="py-2 pr-3">{c.status}</td>
                      <td className="hidden py-2 pr-3 md:table-cell">{c.referredProfileId}</td>
                      <td className="hidden py-2 pr-3 tabular-nums md:table-cell">
                        {formatDecimal(c.feeAmountSource)}
                      </td>
                      <td className="hidden py-2 pr-3 tabular-nums sm:table-cell">
                        {formatDecimal(c.commissionRate, 4)}
                      </td>
                      <td className="py-2 tabular-nums">
                        {formatDecimal(c.commissionAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
