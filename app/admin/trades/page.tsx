import { requireUser } from "@/lib/auth/require-user";
import { getAdminTrades } from "@/lib/services/admin-data";
import { formatDecimal } from "@/lib/helpers/format-decimal";

function SidePill({ side }: { side: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
      side === "yes"
        ? "border-teal-400/20 bg-teal-400/10 text-teal-400"
        : "border-rose-400/20 bg-rose-400/10 text-rose-400"
    }`}>
      {side === "yes" ? "UP" : "DOWN"}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
      status === "filled"
        ? "border-teal-400/20 bg-teal-400/10 text-teal-400"
        : "border-slate-600 bg-slate-800 text-slate-400"
    }`}>
      {status}
    </span>
  );
}

export default async function AdminTradesPage() {
  const { profile } = await requireUser();
  if (profile.role !== "admin") {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/5">
        <p className="text-sm text-rose-400">Access denied.</p>
      </div>
    );
  }

  const trades = await getAdminTrades();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Trades</h1>
        <p className="mt-1 text-sm text-slate-500">Most recent 200 trades across all users</p>
      </div>

      {trades.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-600">No trades found.</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border border-white/[0.06] bg-[#111318] overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["User", "Market", "Side", "Amount", "Price", "Units", "Fee", "Status", "Date"].map((h) => (
                    <th key={h} className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {trades.map((t) => (
                  <tr key={t.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-xs text-slate-400">{t.userEmail}</td>
                    <td className="px-4 py-3 max-w-[160px] truncate text-xs font-medium text-slate-200">{t.marketTitle}</td>
                    <td className="px-4 py-3"><SidePill side={t.side} /></td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-200">${formatDecimal(t.amount, 2)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">${formatDecimal(t.price, 4)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{formatDecimal(t.positionUnits, 4)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">${formatDecimal(t.feeAmount, 4)}</td>
                    <td className="px-4 py-3"><StatusPill status={t.status} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {trades.map((t) => (
              <div key={t.id} className="rounded-xl border border-white/[0.06] bg-[#111318] p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slate-200 line-clamp-2 leading-snug">{t.marketTitle}</p>
                  <SidePill side={t.side} />
                </div>
                <p className="text-xs text-slate-500 break-all">{t.userEmail}</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Amount",  value: `$${formatDecimal(t.amount, 2)}` },
                    { label: "Price",   value: `$${formatDecimal(t.price, 4)}` },
                    { label: "Units",   value: formatDecimal(t.positionUnits, 4) },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-white/[0.03] px-2.5 py-2">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">{label}</p>
                      <p className="mt-0.5 font-mono text-xs font-semibold text-slate-300">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <StatusPill status={t.status} />
                  <span className="font-mono text-xs text-slate-600">
                    {new Date(t.createdAt).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
