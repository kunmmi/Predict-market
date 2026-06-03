import { requireUser } from "@/lib/auth/require-user";
import { getAdminUsers } from "@/lib/services/admin-data";

function RolePill({ role }: { role: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
      role === "admin"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-400"
        : "border-slate-600 bg-slate-800 text-slate-400"
    }`}>
      {role}
    </span>
  );
}

function KycPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    approved: "border-teal-400/20 bg-teal-400/10 text-teal-400",
    pending:  "border-amber-400/20 bg-amber-400/10 text-amber-400",
    rejected: "border-rose-400/20 bg-rose-400/10 text-rose-400",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles[status] ?? "border-slate-600 bg-slate-800 text-slate-400"}`}>
      {status}
    </span>
  );
}

export default async function AdminUsersPage() {
  const { profile } = await requireUser();
  if (profile.role !== "admin") {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/5">
        <p className="text-sm text-rose-400">Access denied.</p>
      </div>
    );
  }

  const users = await getAdminUsers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Users</h1>
        <p className="mt-1 text-sm text-slate-500">
          {users.length} registered profile{users.length !== 1 ? "s" : ""}
        </p>
      </div>

      {users.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-600">No users found.</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border border-white/[0.06] bg-[#111318] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Email", "Display Name", "Role", "KYC", "Joined"].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {users.map((user) => (
                  <tr key={user.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5 font-medium text-slate-200">{user.email}</td>
                    <td className="px-5 py-3.5 text-slate-400">{user.displayName ?? "—"}</td>
                    <td className="px-5 py-3.5"><RolePill role={user.role} /></td>
                    <td className="px-5 py-3.5"><KycPill status={user.kycStatus} /></td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-500">
                      {new Date(user.createdAt).toLocaleDateString("en-US", {
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
            {users.map((user) => (
              <div key={user.id} className="rounded-xl border border-white/[0.06] bg-[#111318] p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slate-200 break-all">{user.email}</p>
                  <RolePill role={user.role} />
                </div>
                {user.displayName && (
                  <p className="text-xs text-slate-400">{user.displayName}</p>
                )}
                <div className="flex items-center justify-between">
                  <KycPill status={user.kycStatus} />
                  <span className="font-mono text-xs text-slate-600">
                    {new Date(user.createdAt).toLocaleDateString("en-US", {
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
