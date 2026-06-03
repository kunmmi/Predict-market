import { requireUser } from "@/lib/auth/require-user";
import { getAdminPromoters } from "@/lib/services/admin-data";
import { formatDecimal } from "@/lib/helpers/format-decimal";

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
      status === "active"
        ? "border-teal-400/20 bg-teal-400/10 text-teal-400"
        : "border-slate-600 bg-slate-800 text-slate-400"
    }`}>
      {status}
    </span>
  );
}

export default async function AdminPromotersPage() {
  const { profile } = await requireUser();
  if (profile.role !== "admin") {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/5">
        <p className="text-sm text-rose-400">Access denied.</p>
      </div>
    );
  }

  const promoters = await getAdminPromoters();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Promoters</h1>
        <p className="mt-1 text-sm text-slate-500">
          {promoters.length} registered promoter{promoters.length !== 1 ? "s" : ""} — referral performance
        </p>
      </div>

      {promoters.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-600">No promoters found.</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border border-white/[0.06] bg-[#111318] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Email", "Promo Code", "Commission Rate", "Total Earned", "Status", "Created"].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {promoters.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5 text-sm font-medium text-slate-200">{p.email}</td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-md bg-violet-400/10 px-2 py-0.5 font-mono text-xs font-semibold text-violet-400 border border-violet-400/20">
                        {p.promoCode}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-sm font-semibold text-slate-200">
                      {(parseFloat(p.commissionRate) * 100).toFixed(1)}%
                    </td>
                    <td className="px-5 py-3.5 font-mono text-sm font-semibold text-teal-400">
                      ${formatDecimal(p.totalEarned, 2)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={p.status} />
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-500">
                      {new Date(p.createdAt).toLocaleDateString("en-US", {
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
            {promoters.map((p) => (
              <div key={p.id} className="rounded-xl border border-white/[0.06] bg-[#111318] p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slate-200 break-all">{p.email}</p>
                  <StatusPill status={p.status} />
                </div>

                <span className="inline-flex rounded-md bg-violet-400/10 px-2 py-0.5 font-mono text-xs font-semibold text-violet-400 border border-violet-400/20">
                  {p.promoCode}
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">Commission</p>
                    <p className="mt-0.5 font-mono text-sm font-semibold text-slate-200">
                      {(parseFloat(p.commissionRate) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">Total Earned</p>
                    <p className="mt-0.5 font-mono text-sm font-semibold text-teal-400">
                      ${formatDecimal(p.totalEarned, 2)}
                    </p>
                  </div>
                </div>

                <p className="font-mono text-xs text-slate-600">
                  Joined {new Date(p.createdAt).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
