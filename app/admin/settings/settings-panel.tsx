"use client";

import { useState, useTransition } from "react";
import { Bot } from "lucide-react";

async function updateSetting(key: string, value: string) {
  const res = await fetch("/api/admin/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  if (!res.ok) throw new Error("Failed to update setting.");
}

function Toggle({
  label,
  description,
  icon: Icon,
  enabled,
  onChange,
  pending,
}: {
  label: string;
  description: string;
  icon: React.ElementType;
  enabled: boolean;
  onChange: (v: boolean) => void;
  pending: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-6 rounded-xl border border-white/[0.06] bg-[#111318] px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/10">
          <Icon className="h-4 w-4 text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <button
        disabled={pending}
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
          enabled ? "bg-teal-500" : "bg-slate-700"
        }`}
        aria-checked={enabled}
        role="switch"
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

export function SettingsPanel({ settings }: { settings: Record<string, string> }) {
  const [marketMakerEnabled, setMarketMakerEnabled] = useState(
    settings["market_maker_enabled"] !== "false",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (key: string, value: boolean) => {
    setError(null);
    startTransition(async () => {
      try {
        await updateSetting(key, value ? "true" : "false");
        if (key === "market_maker_enabled") setMarketMakerEnabled(value);
      } catch {
        setError("Failed to save setting. Please try again.");
      }
    });
  };

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-400">
          {error}
        </p>
      )}
      <Toggle
        label="House Market Maker"
        description="Automatically places house limit orders around the current price when a new round starts. Disable to stop the system account from placing any orders."
        icon={Bot}
        enabled={marketMakerEnabled}
        onChange={(v) => handleToggle("market_maker_enabled", v)}
        pending={isPending}
      />
    </div>
  );
}
