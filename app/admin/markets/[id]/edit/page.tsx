import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/require-admin";
import { getMarketByIdAdmin, getMarketOutcomesAdmin } from "@/lib/services/market-data";
import { AdminMarketEditForm } from "./edit-form";

type Props = { params: { id: string } };

export default async function AdminMarketEditPage({ params }: Props) {
  await requireAdmin();
  const market = await getMarketByIdAdmin(params.id);
  if (!market) notFound();

  const outcomes = market.marketType === "multi"
    ? await getMarketOutcomesAdmin(market.id)
    : [];

  return <AdminMarketEditForm market={market} outcomes={outcomes} />;
}
