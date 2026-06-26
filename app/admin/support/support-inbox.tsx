"use client";

import * as React from "react";
import { Loader2, ArrowLeft, MessageSquare } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { SupportChat } from "@/components/support/support-chat";

type Conversation = {
  profileId: string;
  name: string;
  email: string | null;
  lastBody: string;
  lastAt: string;
  lastRole: "user" | "admin";
  unread: number;
};

function timeAgo(iso: string, zh: boolean): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return zh ? "刚刚" : "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function SupportInbox({ locale }: { locale: "en" | "zh" }) {
  const zh = locale === "zh";
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/support/conversations");
      const json = (await res.json()) as { conversations?: Conversation[] };
      setConversations(json.conversations ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  // Realtime: any new support message refreshes the inbox list.
  React.useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let t: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel("support:inbox")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        () => {
          if (t) clearTimeout(t);
          t = setTimeout(() => void load(), 300); // debounce bursts
        },
      )
      .subscribe();
    // Fallback poll in case Realtime delivery is delayed/blocked.
    const poll = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void load();
    }, 20_000);
    return () => { if (t) clearTimeout(t); clearInterval(poll); void supabase.removeChannel(channel); };
  }, [load]);

  const selectedConv = conversations.find((c) => c.profileId === selected) ?? null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{zh ? "客服消息" : "Support Inbox"}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {zh ? "实时回复用户的支持请求。" : "Reply to user support requests in real time."}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        {/* Conversation list */}
        <div className={`${selected ? "hidden md:block" : "block"} rounded-xl border border-white/[0.06] bg-[#111318] overflow-hidden`}>
          <div className="border-b border-white/[0.06] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {zh ? "对话" : "Conversations"}
          </div>
          <div className="max-h-[70vh] divide-y divide-white/[0.04] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-10 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <MessageSquare className="mb-2 h-7 w-7 text-slate-600" />
                <p className="text-sm text-slate-500">{zh ? "暂无消息" : "No messages yet"}</p>
              </div>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.profileId}
                  onClick={() => setSelected(c.profileId)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.02] ${
                    selected === c.profileId ? "bg-white/[0.03]" : ""
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-sm font-semibold text-amber-400">
                    {(c.name || "U").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-white">{c.name}</p>
                      <span className="shrink-0 text-[10px] text-slate-600">{timeAgo(c.lastAt, zh)}</span>
                    </div>
                    <p className="truncate text-xs text-slate-500">
                      {c.lastRole === "admin" ? (zh ? "你: " : "You: ") : ""}{c.lastBody}
                    </p>
                  </div>
                  {c.unread > 0 && (
                    <span className="mt-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-slate-900">
                      {c.unread}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Thread */}
        <div className={`${selected ? "block" : "hidden md:block"} h-[72vh] min-h-[460px]`}>
          {selectedConv ? (
            <div className="flex h-full flex-col">
              <button
                onClick={() => setSelected(null)}
                className="mb-2 flex items-center gap-1 text-xs text-slate-500 hover:text-white md:hidden"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> {zh ? "返回" : "Back"}
              </button>
              <div className="min-h-0 flex-1">
                <SupportChat
                  conversationProfileId={selectedConv.profileId}
                  isAdmin
                  locale={locale}
                  headerName={selectedConv.name}
                />
              </div>
            </div>
          ) : (
            <div className="hidden h-full flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-[#111318] text-center md:flex">
              <MessageSquare className="mb-3 h-9 w-9 text-slate-700" />
              <p className="text-sm text-slate-500">{zh ? "选择一个对话开始回复" : "Select a conversation to reply"}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
