import { requireUser } from "@/lib/auth/require-user";
import { getAdminCommissions } from "@/lib/services/admin-data";
import { CommissionsTable } from "./commissions-table";

export default async function AdminCommissionsPage() {
  const { profile } = await requireUser();
  if (profile.role !== "admin") {
    return (
      <div className="py-10 text-center text-sm text-slate-500">Access denied.</div>
    );
  }

  const commissions = await getAdminCommissions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Commissions</h1>
        <p className="page-subtitle">
          Promoter commissions generated from referred user trades. Mark as approved or
          paid once transferred.
        </p>
      </div>
      <CommissionsTable initialCommissions={commissions} />
    </div>
  );
}
