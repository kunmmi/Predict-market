"use client";

import { useEffect } from "react";
import { MessageCircle, Clock, Shield, Zap } from "lucide-react";

export default function SupportPage() {
  useEffect(() => {
    // Load Crisp only on this page and open it immediately
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

    // Hide chat when leaving this page
    return () => {
      try { window.$crisp.push(["do", "chat:hide"]); } catch {}
    };
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8 px-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Support</h1>
        <p className="mt-1 text-sm text-slate-500">
          We&apos;re here to help. Start a chat and we&apos;ll get back to you as soon as possible.
        </p>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            icon: MessageCircle,
            title: "Live Chat",
            desc: "Chat with our team directly from this page.",
            color: "text-amber-400",
            bg: "bg-amber-400/10",
            border: "border-amber-400/20",
          },
          {
            icon: Clock,
            title: "Response Time",
            desc: "We typically reply within a few hours.",
            color: "text-teal-400",
            bg: "bg-teal-400/10",
            border: "border-teal-400/20",
          },
          {
            icon: Shield,
            title: "Safe & Private",
            desc: "Never share your password or private keys.",
            color: "text-slate-400",
            bg: "bg-slate-400/10",
            border: "border-slate-400/20",
          },
        ].map(({ icon: Icon, title, desc, color, bg, border }) => (
          <div key={title} className={`rounded-xl border ${border} bg-[#111318] p-4`}>
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg}`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <p className="mt-3 text-sm font-semibold text-white">{title}</p>
            <p className="mt-1 text-xs text-slate-500">{desc}</p>
          </div>
        ))}
      </div>

      {/* Common topics */}
      <div className="rounded-xl border border-white/[0.06] bg-[#111318] overflow-hidden">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Common Topics</h2>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {[
            "My deposit hasn't been credited",
            "Withdrawal not received",
            "I can't log in to my account",
            "How do prediction markets work?",
            "Referral / promoter commissions",
            "Something looks wrong with my balance",
          ].map((topic) => (
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
        The chat window should have opened automatically. If not,{" "}
        <button
          className="text-amber-400 hover:underline"
          onClick={() => {
            try {
              window.$crisp.push(["do", "chat:show"]);
              window.$crisp.push(["do", "chat:open"]);
            } catch {}
          }}
        >
          click here
        </button>{" "}
        to open it.
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
