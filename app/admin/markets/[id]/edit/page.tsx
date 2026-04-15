import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/require-admin";
import { getMarketByIdAdmin } from "@/lib/services/market-data";
import { AdminMarketEditForm } from "./edit-form";

type Props = { params: { id: string } };

export default async function AdminMarketEditPage({ params }: Props) {
  await requireAdmin();
  const market = await getMarketByIdAdmin(params.id);
  if (!market) notFound();

  return <AdminMarketEditForm market={market} />;
}
