import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SettingsPanel } from "./settings-panel";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin();

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("platform_settings")
    .select("key, value");

  const settings = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Platform Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Toggle runtime platform behaviour without redeploying.</p>
      </div>
      <SettingsPanel settings={settings} />
    </div>
  );
}
