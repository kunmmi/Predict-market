import { requireUser } from "@/lib/auth/require-user";
import { getAdminTrades } from "@/lib/services/admin-data";
import { Badge } from "@/components/ui/badge";
import { formatDecimal } from "@/lib/helpers/format-decimal";

export default async function AdminTradesPage() {
  const { profile } = await requireUser();
  if (profile.role !== "admin") {
    return <div className="py-10 text-center text-sm text-slate-500">Access denied.</div>;
  }

  const trades = await getAdminTrades();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Trades ({trades.length})</h1>
        <p className="page-subtitle">Most recent 200 trades across all users.</p>
      </div>

      <div className="surface-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Market</th>
              <th className="px-4 py-3">Side</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Units</th>
              <th className="px-4 py-3">Fee</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 text-slate-700">{t.userEmail}</td>
                <td className="max-w-[160px] truncate px-4 py-3 font-medium text-slate-800">
                  {t.marketTitle}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={t.side === "yes" ? "default" : "secondary"} className="text-xs">
                    {t.side.toUpperCase()}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-700">${formatDecimal(t.amount, 2)}</td>
                <td className="px-4 py-3 text-slate-700">${formatDecimal(t.price, 4)}</td>
                <td className="px-4 py-3 text-slate-700">{formatDecimal(t.positionUnits, 4)}</td>
                <td className="px-4 py-3 text-slate-500">${formatDecimal(t.feeAmount, 4)}</td>
                <td className="px-4 py-3">
                  <Badge variant={t.status === "filled" ? "default" : "secondary"} className="text-xs">
                    {t.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {new Date(t.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {trades.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">No trades found.</p>
        )}
      </div>
    </div>
  );
}
