import { requireUser } from "@/lib/auth/require-user";
import { getAdminUsers } from "@/lib/services/admin-data";
import { UsersTable } from "./users-table";

export default async function AdminUsersPage() {
  const { profile } = await requireUser();
  if (profile.role !== "admin") {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/5">
        <p className="text-sm text-rose-400">Access denied.</p>
      </div>
    );
  }

  let users;
  try {
    users = await getAdminUsers();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">Users</h1>
        <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-6">
          <p className="text-sm text-rose-400">Failed to load users: {msg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Users</h1>
        <p className="mt-1 text-sm text-slate-500">
          {users.length} registered user{users.length !== 1 ? "s" : ""}
        </p>
      </div>

      <UsersTable initialUsers={users} />
    </div>
  );
}
