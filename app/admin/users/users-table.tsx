"use client";

import * as React from "react";
import Link from "next/link";
import { Search, ShieldCheck, ShieldOff, ExternalLink } from "lucide-react";

import type { AdminUserRow } from "@/lib/services/admin-data";

// ---------------------------------------------------------------------------
// Pills
// ---------------------------------------------------------------------------

function RolePill({ role }: { role: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
      role === "admin"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-400"
        : "border-slate-600 bg-slate-800 text-slate-400"
    }`}>
      {role === "admin" && <ShieldCheck className="h-2.5 w-2.5" />}
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

// ---------------------------------------------------------------------------
// Role toggle
// ---------------------------------------------------------------------------

function RoleToggle({
  user,
  onUpdated,
}: {
  user: AdminUserRow;
  onUpdated: (id: string, newRole: string) => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const isAdmin = user.role === "admin";

  async function toggle() {
    const newRole = isAdmin ? "user" : "admin";
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const json = await res.json() as { success: boolean; message?: string };
      if (!json.success) {
        setError(json.message ?? "Failed.");
        return;
      }
      onUpdated(user.id, newRole);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        disabled={loading}
        onClick={() => void toggle()}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${
          isAdmin
            ? "border-rose-400/20 bg-rose-400/10 text-rose-400 hover:bg-rose-400/20"
            : "border-teal-400/20 bg-teal-400/10 text-teal-400 hover:bg-teal-400/20"
        }`}
      >
        {loading ? (
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
        ) : isAdmin ? (
          <ShieldOff className="h-2.5 w-2.5" />
        ) : (
          <ShieldCheck className="h-2.5 w-2.5" />
        )}
        {loading ? "Saving…" : isAdmin ? "Remove admin" : "Make admin"}
      </button>
      {error && <p className="text-[10px] text-rose-400">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main table
// ---------------------------------------------------------------------------

export function UsersTable({ initialUsers }: { initialUsers: AdminUserRow[] }) {
  const [users, setUsers] = React.useState<AdminUserRow[]>(initialUsers);
  const [search, setSearch] = React.useState("");

  // Client-side filter — no extra API call needed, all users already loaded
  const filtered = search.trim()
    ? users.filter((u) => {
        const q = search.toLowerCase();
        return (
          u.email.toLowerCase().includes(q) ||
          (u.displayName?.toLowerCase().includes(q) ?? false)
        );
      })
    : users;

  const adminCount = filtered.filter((u) => u.role === "admin").length;

  function handleRoleUpdated(id: string, newRole: string) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: newRole } : u)));
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or name…"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] py-2 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-600 focus:border-amber-400/40 focus:outline-none transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>
        <p className="shrink-0 text-xs text-slate-500">
          {filtered.length} user{filtered.length !== 1 ? "s" : ""}
          {adminCount > 0 && ` · ${adminCount} admin${adminCount !== 1 ? "s" : ""}`}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-600">
          {search ? `No users match "${search}".` : "No users found."}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border border-white/[0.06] bg-[#111318] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Email", "Display Name", "Role", "KYC", "Joined", "Actions"].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map((user) => (
                  <tr key={user.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/users/${user.id}`} className="group flex items-center gap-1.5">
                        <span className="font-medium text-slate-200 group-hover:text-amber-400 transition-colors">{user.email}</span>
                        <ExternalLink className="h-3 w-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">{user.displayName ?? "—"}</td>
                    <td className="px-5 py-3.5"><RolePill role={user.role} /></td>
                    <td className="px-5 py-3.5"><KycPill status={user.kycStatus} /></td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-500">
                      {new Date(user.createdAt).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3.5">
                      <RoleToggle user={user} onUpdated={handleRoleUpdated} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((user) => (
              <div key={user.id} className="rounded-xl border border-white/[0.06] bg-[#111318] p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/admin/users/${user.id}`} className="group flex items-center gap-1">
                      <p className="text-sm font-medium text-slate-200 break-all group-hover:text-amber-400 transition-colors">{user.email}</p>
                      <ExternalLink className="h-3 w-3 shrink-0 ml-1 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                    {user.displayName && (
                      <p className="mt-0.5 text-xs text-slate-400">{user.displayName}</p>
                    )}
                  </div>
                  <RolePill role={user.role} />
                </div>

                <div className="flex items-center justify-between">
                  <KycPill status={user.kycStatus} />
                  <span className="font-mono text-xs text-slate-600">
                    {new Date(user.createdAt).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </span>
                </div>

                <RoleToggle user={user} onUpdated={handleRoleUpdated} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
