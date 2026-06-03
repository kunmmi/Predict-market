export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminLogs } from "@/lib/services/admin-data";

export default async function AdminLogsPage() {
  await requireAdmin();
  const logs = await getAdminLogs(200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Admin Logs</h1>
        <p className="mt-1 text-sm text-slate-500">
          Audit trail for admin financial and operational actions — last 200 events.
        </p>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#111318] overflow-hidden">
        {logs.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-600">No admin logs available.</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Action", "Target Table", "Target ID", "Notes", "Timestamp"].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {logs.map((log) => (
                    <tr key={log.id} className="align-top transition-colors hover:bg-white/[0.02]">
                      <td className="px-5 py-3.5 text-sm font-semibold text-slate-200">
                        {log.actionType}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-slate-300">
                          {log.targetTable}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 max-w-[200px] truncate font-mono text-xs text-slate-500">
                        {log.targetId}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{log.notes ?? "—"}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs text-slate-600">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <div className="md:hidden divide-y divide-white/[0.04]">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3.5">
                  <div className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400/60" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-sm font-semibold text-slate-200">{log.actionType}</span>
                      <span className="text-xs text-slate-500">on</span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-slate-300">
                        {log.targetTable}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-slate-600">{log.targetId}</p>
                    {log.notes && <p className="mt-1 text-xs text-slate-500">{log.notes}</p>}
                    <p className="mt-1 font-mono text-[10px] text-slate-600">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
