import { requireAdmin } from "@/lib/auth/require-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDecimal } from "@/lib/helpers/format-decimal";
import { getAdminDashboardData } from "@/lib/services/admin-data";

export default async function AdminHomePage() {
  const { profile } = await requireAdmin();
  const data = await getAdminDashboardData();
  const cards = [
    { label: "Profiles", value: String(data.summary.totalProfiles) },
    { label: "Promoters", value: String(data.summary.totalPromoters) },
    { label: "Referrals", value: String(data.summary.totalReferrals) },
    { label: "Deposits", value: String(data.summary.totalDeposits) },
    { label: "Approved deposits", value: String(data.summary.totalApprovedDeposits) },
    { label: "Active markets", value: String(data.summary.totalActiveMarkets) },
    { label: "Trades", value: String(data.summary.totalTrades) },
    {
      label: "Trade volume",
      value: formatDecimal(data.summary.totalTradeVolume, 2),
    },
    {
      label: "Platform fees",
      value: formatDecimal(data.summary.totalPlatformFees, 2),
    },
    {
      label: "Promoter commissions",
      value: formatDecimal(data.summary.totalPromoterCommissions, 2),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="page-title">Admin dashboard</h1>
        <p className="text-sm text-slate-600">Signed in as {profile.email}</p>
        {data.warning ? (
          <p className="text-sm text-amber-700">
            Admin metrics are limited: {data.warning}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tracking-tight text-slate-900">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent admin logs</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentAdminLogs.length === 0 ? (
            <p className="text-sm text-slate-600">No admin activity logged yet.</p>
          ) : (
            <ul className="space-y-3 text-sm text-slate-700">
              {data.recentAdminLogs.map((log) => (
                <li key={log.id} className="rounded-md border border-slate-200 p-3">
                  <p>
                    <span className="font-medium">{log.actionType}</span> on{" "}
                    <span className="font-medium">{log.targetTable}</span>
                  </p>
                  <p className="text-xs text-slate-500">Target: {log.targetId}</p>
                  {log.notes ? <p className="mt-1">{log.notes}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
