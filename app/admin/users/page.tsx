import { requireUser } from "@/lib/auth/require-user";
import { getAdminUsers } from "@/lib/services/admin-data";
import { Badge } from "@/components/ui/badge";

export default async function AdminUsersPage() {
  const { profile } = await requireUser();
  if (profile.role !== "admin") {
    return <div className="py-10 text-center text-sm text-slate-500">Access denied.</div>;
  }

  const users = await getAdminUsers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Users ({users.length})</h1>
        <p className="page-subtitle">All registered user profiles.</p>
      </div>

      <div className="surface-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Display Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">KYC</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-800">{user.email}</td>
                <td className="px-4 py-3 text-slate-600">{user.displayName ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {user.role}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={
                      user.kycStatus === "approved"
                        ? "default"
                        : user.kycStatus === "pending"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {user.kycStatus}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {new Date(user.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">No users found.</p>
        )}
      </div>
    </div>
  );
}
