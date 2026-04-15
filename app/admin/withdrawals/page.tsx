import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminWithdrawals } from "@/lib/services/withdrawal-data";
import { WithdrawalsTable } from "./withdrawals-table";

export default async function AdminWithdrawalsPage() {
  await requireAdmin();

  const initialWithdrawals = await getAdminWithdrawals("pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Withdrawals</h1>
        <p className="page-subtitle">
          Review and process user withdrawal requests. Approving a withdrawal debits the
          user&apos;s wallet — send funds to their address manually after approving.
        </p>
      </div>

      <WithdrawalsTable initialWithdrawals={initialWithdrawals} />
    </div>
  );
}
