"use client";

import { useEffect } from "react";
import { MessageCircle, Clock, Shield, Zap } from "lucide-react";
import type { Locale, T } from "@/lib/i18n/translations";

type Props = { locale: Locale; t: T["support"] };

export function SupportContent({ locale, t }: Props) {
  void locale;

  useEffect(() => {
    window.$crisp = [];
    window.CRISP_WEBSITE_ID = "192383fc-e562-4550-b428-cea293140947";
    window.$crisp.push(["config", "color:theme", "#E8A020"]);

    const existing = document.getElementById("crisp-script");
    if (!existing) {
      const s = document.createElement("script");
      s.id = "crisp-script";
      s.src = "https://client.crisp.chat/l.js";
      s.async = true;
      s.onload = () => {
        window.$crisp.push(["do", "chat:show"]);
        window.$crisp.push(["do", "chat:open"]);
      };
      document.head.appendChild(s);
    } else {
      window.$crisp.push(["do", "chat:show"]);
      window.$crisp.push(["do", "chat:open"]);
    }

    return () => {
      try { window.$crisp.push(["do", "chat:hide"]); } catch {}
    };
  }, []);

  const cards = [
    { icon: MessageCircle, title: t.live_chat,     desc: t.live_chat_desc,     color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20" },
    { icon: Clock,         title: t.response_time, desc: t.response_time_desc, color: "text-teal-400",  bg: "bg-teal-400/10",  border: "border-teal-400/20" },
    { icon: Shield,        title: t.safe_private,  desc: t.safe_private_desc,  color: "text-slate-400", bg: "bg-slate-400/10", border: "border-slate-400/20" },
  ];

  const topics = [
    t.topic_deposit,
    t.topic_withdrawal,
    t.topic_login,
    t.topic_how,
    t.topic_referral,
    t.topic_balance,
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8 px-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{t.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{t.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map(({ icon: Icon, title, desc, color, bg, border }) => (
          <div key={title} className={`rounded-xl border ${border} bg-[#111318] p-4`}>
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg}`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <p className="mt-3 text-sm font-semibold text-white">{title}</p>
            <p className="mt-1 text-xs text-slate-500">{desc}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#111318] overflow-hidden">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-sm font-semibold text-white">{t.common_topics}</h2>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {topics.map((topic) => (
            <button
              key={topic}
              onClick={() => {
                try {
                  window.$crisp.push(["do", "chat:open"]);
                  window.$crisp.push(["do", "message:send", ["text", topic]]);
                } catch {}
              }}
              className="flex w-full items-center justify-between px-5 py-3.5 text-left text-sm text-slate-400 transition-colors hover:bg-white/[0.02] hover:text-white"
            >
              <span>{topic}</span>
              <Zap className="h-3 w-3 shrink-0 text-amber-400/50" />
            </button>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-slate-600">
        {t.chat_auto}{" "}
        <button
          className="text-amber-400 hover:underline"
          onClick={() => {
            try {
              window.$crisp.push(["do", "chat:show"]);
              window.$crisp.push(["do", "chat:open"]);
            } catch {}
          }}
        >
          {t.chat_click}
        </button>{" "}
        {t.chat_end}
      </p>
    </div>
  );
}

declare global {
  interface Window {
    $crisp: unknown[];
    CRISP_WEBSITE_ID: string;
  }
}
