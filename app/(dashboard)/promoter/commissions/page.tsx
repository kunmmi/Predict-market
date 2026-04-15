import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/require-user";
import { formatDecimal } from "@/lib/helpers/format-decimal";
import {
  getPromoterCommissions,
  getPromoterSummaryByProfileId,
} from "@/lib/services/promoter-data";

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function PromoterCommissionsPage() {
  const { profile } = await requireUser();
  const summary = await getPromoterSummaryByProfileId(profile.id);

  if (!summary) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-slate-700">
          Promoter profile not found.{" "}
          <Link className="underline" href="/promoter/register">
            Register as promoter
          </Link>
          .
        </CardContent>
      </Card>
    );
  }

  const commissions = await getPromoterCommissions(summary.promoterId, 200);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Commission history</h1>
        <p className="page-subtitle">
          Promo code:{" "}
          <code className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
            {summary.promoCode}
          </code>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Commissions</CardTitle>
        </CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <p className="text-sm text-slate-600">No commissions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="hidden pb-2 pr-3 font-medium sm:table-cell">When</th>
                    <th className="pb-2 pr-3 font-medium">Status</th>
                    <th className="hidden pb-2 pr-3 font-medium md:table-cell">Referred profile</th>
                    <th className="hidden pb-2 pr-3 font-medium md:table-cell">Fee source</th>
                    <th className="hidden pb-2 pr-3 font-medium sm:table-cell">Rate</th>
                    <th className="pb-2 font-medium">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100 last:border-0">
                      <td className="hidden py-2 pr-3 sm:table-cell">{formatWhen(c.createdAt)}</td>
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
