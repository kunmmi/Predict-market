import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/require-user";
import {
  getPromoterReferrals,
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

export default async function PromoterReferralsPage() {
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

  const referrals = await getPromoterReferrals(summary.promoterId, 200);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Referral list</h1>
        <p className="page-subtitle">
          Promo code:{" "}
          <code className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
            {summary.promoCode}
          </code>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Referrals</CardTitle>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <p className="text-sm text-slate-600">No referrals yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="hidden pb-2 pr-3 font-medium sm:table-cell">When</th>
                    <th className="pb-2 pr-3 font-medium">Referred profile</th>
                    <th className="pb-2 font-medium">Promo code used</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0">
                      <td className="hidden py-2 pr-3 sm:table-cell">{formatWhen(r.createdAt)}</td>
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
    </div>
  );
}
