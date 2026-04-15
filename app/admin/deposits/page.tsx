import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminDeposits } from "@/lib/services/admin-data";
import { DepositsTable } from "./deposits-table";

export default async function AdminDepositsPage() {
  await requireAdmin();

  // Load pending deposits by default for the initial render
  const initialDeposits = await getAdminDeposits("pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Deposits</h1>
        <p className="page-subtitle">
          Review and approve or reject user deposit requests. Approving a deposit
          credits the user&apos;s wallet immediately.
        </p>
      </div>

      <DepositsTable initialDeposits={initialDeposits} />
    </div>
  );
}
