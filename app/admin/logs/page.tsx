import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminLogs } from "@/lib/services/admin-data";

export default async function AdminLogsPage() {
  await requireAdmin();
  const logs = await getAdminLogs(200);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="page-title">Admin logs</h1>
        <p className="page-subtitle">
          Audit trail for admin financial and operational actions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent events</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-slate-600">No admin logs available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="px-2 py-2 font-medium">Action</th>
                    <th className="px-2 py-2 font-medium">Target table</th>
                    <th className="px-2 py-2 font-medium">Target id</th>
                    <th className="px-2 py-2 font-medium">Notes</th>
                    <th className="px-2 py-2 font-medium">Created at</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-100 align-top">
                      <td className="px-2 py-2 font-medium text-slate-900">
                        {log.actionType}
                      </td>
                      <td className="px-2 py-2">{log.targetTable}</td>
                      <td className="max-w-xs truncate px-2 py-2 font-mono text-xs text-slate-700">
                        {log.targetId}
                      </td>
                      <td className="px-2 py-2">{log.notes ?? "—"}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-slate-600">
                        {new Date(log.createdAt).toLocaleString()}
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
