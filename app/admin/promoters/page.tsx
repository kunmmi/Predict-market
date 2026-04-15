import { requireUser } from "@/lib/auth/require-user";
import { getAdminPromoters } from "@/lib/services/admin-data";
import { Badge } from "@/components/ui/badge";
import { formatDecimal } from "@/lib/helpers/format-decimal";

export default async function AdminPromotersPage() {
  const { profile } = await requireUser();
  if (profile.role !== "admin") {
    return <div className="py-10 text-center text-sm text-slate-500">Access denied.</div>;
  }

  const promoters = await getAdminPromoters();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Promoters ({promoters.length})</h1>
        <p className="page-subtitle">
          Registered promoters and their referral performance.
        </p>
      </div>

      <div className="surface-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Promo Code</th>
              <th className="px-4 py-3">Commission Rate</th>
              <th className="px-4 py-3">Total Earned</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {promoters.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-800">{p.email}</td>
                <td className="px-4 py-3">
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                    {p.promoCode}
                  </code>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {(parseFloat(p.commissionRate) * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">
                  ${formatDecimal(p.totalEarned, 2)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={p.status === "active" ? "default" : "secondary"}>
                    {p.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {new Date(p.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {promoters.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">No promoters found.</p>
        )}
      </div>
    </div>
  );
}
