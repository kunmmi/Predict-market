import Link from "next/link";

import { requireAdmin } from "@/lib/auth/require-admin";
import { getAllMarketsAdmin } from "@/lib/services/market-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDecimal } from "@/lib/helpers/format-decimal";

export default async function AdminMarketsPage() {
  await requireAdmin();
  const markets = await getAllMarketsAdmin();

  const statusVariant = (s: string) =>
    s === "active"
      ? "default"
      : s === "settled"
        ? "secondary"
        : s === "cancelled"
          ? "destructive"
          : "secondary";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Markets</h1>
          <p className="page-subtitle">Manage all prediction markets.</p>
        </div>
        <Link href="/admin/markets/new">
          <Button>Create Market</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Markets ({markets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {markets.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No markets yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="pb-3 pr-4">Title</th>
                    <th className="pb-3 pr-4">Asset</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">YES / NO</th>
                    <th className="pb-3 pr-4">Closes</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {markets.map((market) => (
                    <tr key={market.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-medium text-slate-800">
                        {market.title}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant="secondary" className="text-xs">
                          {market.assetSymbol}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={statusVariant(market.status)} className="text-xs">
                          {market.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        <span className="text-green-700">
                          {market.latestYesPrice != null
                            ? `$${formatDecimal(market.latestYesPrice, 4)}`
                            : "—"}
                        </span>
                        {" / "}
                        <span className="text-red-700">
                          {market.latestNoPrice != null
                            ? `$${formatDecimal(market.latestNoPrice, 4)}`
                            : "—"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {new Date(market.closeAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-3">
                        <Link href={`/admin/markets/${market.id}/edit`}>
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                        </Link>
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
