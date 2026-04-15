import { requireUser } from "@/lib/auth/require-user";
import { getAdminReferrals } from "@/lib/services/admin-data";
import { Badge } from "@/components/ui/badge";
import { formatDecimal } from "@/lib/helpers/format-decimal";

export default async function AdminReferralsPage() {
  const { profile } = await requireUser();
  if (profile.role !== "admin") {
    return <div className="py-10 text-center text-sm text-slate-500">Access denied.</div>;
  }

  const referrals = await getAdminReferrals();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Referrals ({referrals.length})</h1>
        <p className="page-subtitle">
          All referral relationships between promoters and users.
        </p>
      </div>

      <div className="surface-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Promo Code</th>
              <th className="px-4 py-3">Referred User</th>
              <th className="px-4 py-3">Commission Paid</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {referrals.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3">
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                    {r.promoterPromoCode}
                  </code>
                </td>
                <td className="px-4 py-3 text-slate-700">{r.referredEmail}</td>
                <td className="px-4 py-3 font-medium text-slate-800">
                  ${formatDecimal(r.commissionPaid, 4)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={r.status === "active" ? "default" : "secondary"}>
                    {r.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {new Date(r.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {referrals.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">No referrals found.</p>
        )}
      </div>
    </div>
  );
}
